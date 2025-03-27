<script>
	import { fade } from 'svelte/transition';
	import { PUBLIC_API_URL } from '$env/static/public';
	import UploadButton from './UploadButton.svelte';
	import { onDestroy } from 'svelte';
	import Video from './ChatComponents/Video.svelte';
	import Audio from './ChatComponents/Audio.svelte';
	import Toast from './Toast.svelte';
	import TranscribeSvg from './TranscribeSvg.svelte';
	import PrintSvg from './PrinterSvg.svelte';
	import ErrorSvg from './ErrorSvg.svelte';
	/**
	 * @typedef {import('./types/toast.type.js').ToastTypes} ToastTypes
	 * @typedef {import('./types/toast.type.js').ToastProps} ToastProps
	 * @typedef {import('jszip')=} JsZip
	 * @typedef {import('mammoth')=} Mammoth
	 * @typedef {import('socket.io-client').default=} SocketIo
	 * @typedef {import('socket.io-client').Socket<DefaultEventsMap, DefaultEventsMap>=} SocketType
	 */

	/** Timeout caso o socketio não consiga conectar */
	const socketConnTimeout = 5000;

	const uuid = crypto.randomUUID();

	/** @type {HTMLDivElement=}*/
	let chatContainer = null;

	/** @type {string=}*/
	let showLimitacoesModal = false;
	let showLGPDModal = false;
	/**
	 * @typedef {object} ApiResult
	 * @property {string} Date
	 * @property {string|false} FileAttached
	 * @property {number} ID
	 * @property {string} Message
	 * @property {string} Name
	 * @property {string} Time
	 * @property {boolean} IsApple
	 * @property {string=} ERRO
	 */
	/**
	 * @typedef {object} ApiError
	 * @property {string=} Erro
	 */
	/** @type {(ApiResult[]|ApiError)=} */
	let result = null;
	/**
	 * @typedef {object} Message
	 * @property {string} Date
	 * @property {string|false} FileAttached
	 * @property {number} ID
	 * @property {string} Message
	 * @property {string} Name
	 * @property {string} Time
	 * @property {string=} FileURL
	 * @property {string=} type
	 * @property {number=} width
	 * @property {number=} height
	 * @property {number=} duration
	 * @property {string=} thumbnail
	 * @property {string[]} links
	 */
	/** @type {Message[]} */
	let messages = [];
	/** @type {FileList=} */
	let files = null;
	// maioria é android
	let isApple = false;

	/**
	 * @typedef {Pick<ToastProps, 'text' | 'onClose'> & {type: Exclude<ToastTypes, 'all'>}} ToastType
	 * @type {ToastType}
	 */
	let toast = {
		text: null,
		type: 'transcribe'
	};
	const loading = !!toast.text && toast.type == 'transcribe';
	const printLoading = toast.type === 'print' && !loading;

	/** @type {Record<ToastTypes, ToastProps>} */
	const toastMap = {
		transcribe: {
			svg: TranscribeSvg
		},
		print: {
			svg: PrintSvg
		},
		error: {
			svg: ErrorSvg,
			error: true
		}
	};

	/** @type {Record<ToastTypes, ToastProps>} */
	$: toastProps = {
		...toastMap[toast.type],

		text: toast.text,
		closed: !toast.text,
		onClose: toast.onClose
	};

	/** @param {ToastTypes} newType */
	const removeToast = (newType) =>
		(toast = { ...toast, text: null, ...(newType && { type: newType }) });

	/** @param {CustomEvent<FileList>} event */
	const updateFiles = (event) => (files = event.detail);

	/** Optimize import on-demand for heavy libs */
	/** @type {JsZip} */
	let JSZip = null;
	/** @type {Mammoth} */
	let mammoth = null;
	/** @type {SocketIo} */
	let io = null;

	/** @type {SocketType} */
	let socket = null;

	onDestroy(() => socket?.disconnect?.());

	const toggleLimitacoesModal = () => (showLimitacoesModal = !showLimitacoesModal);

	const toggleLGPDModal = () => (showLGPDModal = !showLGPDModal);

	/** @param {[string, string, Blob][]} urls */
	const processMessages = async (urls) =>
		(async () => {
			const fileMap = new Map(urls.map(([url, filename, blob]) => [filename, { url, blob }]));

			messages = await Promise.all(
				messages.map(async (msg) => {
					const match = fileMap.get(msg.FileAttached);
					if (match) {
						const fileInfo = await getFileInfo(match.blob, msg.FileAttached);
						return { ...msg, FileURL: match.url, ...fileInfo };
					}
					return msg;
				})
			);

			removeToast('print');
		})();

	/** @param {File} file */
	async function processZipFile(file) {
		JSZip ??= (await import('jszip')).default;
		const zip = new JSZip();
		const contents = await zip.loadAsync(file);

		const urls = Object.entries(contents.files).map(async ([filename, zipEntry]) => {
			const arrayBuffer = await zipEntry.async('arraybuffer');
			const blob = new Blob([arrayBuffer], { type: getFileType(filename) });
			const url = URL.createObjectURL(blob);
			return [url, filename, blob];
		});

		return Promise.all(urls);
	}

	const verifyFileErr = 'Erro ao Processar, Verifique o Arquivo.';

	/** @param {File} file */
	const processConversation = (file) => {
		processZipFile(file)
			.then((urls) => processMessages(urls))
			.catch((e) => {
				toast = ({
					type: 'error',
					text: verifyFileErr
				});
				console.error(e);
			});
	};

	const getExt = (/** @type {string} */ filename) => filename.split('.').pop().toLowerCase();

	/** @param {string} filename */
	function getFileType(filename) {
		const ext = getExt(filename);
		switch (ext) {
			case 'pdf':
				return 'application/pdf';
			case 'docx':
			case 'docm':
			case 'doc':
			case 'odt':
				return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
			case 'pptx':
			case 'ppt':
			case 'odp':
				return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
			case 'xlsx':
			case 'xls':
			case 'ods':
				return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
			case 'jpg':
			case 'jpeg':
				return 'image/jpeg';
			case 'png':
				return 'image/png';
			case 'gif':
				return 'image/gif';
			case 'mp4':
				return 'video/mp4';
			case 'opus':
				return 'audio/opus';
			default:
				return 'application/octet-stream';
		}
	}

	/**
	 * @param {Blob} blob
	 * @param {string} filename
	 */
	async function getFileInfo(blob, filename) {
		const ext = getExt(filename);
		switch (ext) {
			case 'pdf':
				return { type: 'pdf' };
			case 'docx':
			case 'docm': // docx + macros enabled
				return await getDocxInfo(blob);
			case 'jpg':
			case 'jpeg':
			case 'png':
			case 'gif':
				return await getImageInfo(blob);
			case 'mp4':
				return await getVideoInfo(blob);
			case 'opus':
				return { type: 'audio' };
			default:
				return {};
		}
	}

	/** @param {Blob} blob */
	async function getDocxInfo(blob) {
		const arrayBuffer = await blob.arrayBuffer();
		mammoth ??= await import('mammoth');
		const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
		const text = htmlResult.value;
		const pages = text.split('\n\n').slice(0, 6);
		return { type: 'docx', pages };
	}

	/** @param {Blob} blob */
	const blobToBase64Url = async (blob) =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (_) => resolve(reader.result);
			reader.onerror = (e) => reject(e);
			reader.readAsDataURL(blob);
		});

	/** @param {Blob} blob */
	const getImageInfo = async (blob) =>
		new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve({ type: 'image', width: img.width, height: img.height });
			img.src = URL.createObjectURL(blob);
		});

	/** @param {Blob} blob */
	const getVideoInfo = async (blob) =>
		new Promise((resolve) => {
			const video = document.createElement('video');
			video.src = URL.createObjectURL(blob);
			video.onloadedmetadata = () => {
				resolve({ type: 'video', duration: video.duration });
			};
		});

	async function connectSocket() {
		/**
		 * Socket.active, if socket still retrying to connect
		 * Socket.connected if the socket is currently connected
		 */
		if (socket?.connected) return;

		io ??= (await import('socket.io-client')).default;
		socket ??= io(PUBLIC_API_URL, {
			reconnectionAttempts: 5,
			transports: ['websocket', 'polling', 'webtransport'],
			timeout: socketConnTimeout,
			query: `uid=${uuid}`
		});

		/** @type {Promise<void>} */
		const connect = new Promise((resolve, _) => socket.on('connect', resolve));
		/** @type {Promise<void>} */
		const timeout = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Connection timed out')), socketConnTimeout)
		);

		Promise.race([connect, timeout]).catch((e) => {
			console.error(e);
			socket = null;
		});

		socket.on('Smessage', (data) => {
			if (!data?.data) return;
			console.log(
				`%c Server message:\n${data.data}`,
				'background-color: #233142; color: #fdffcd; display: grid; place-items: center;'
			);
			toast = ({ ...toast, text: data.data });
		});
	}

	/** @param {SubmitEvent} ev */
	async function handleSubmit(ev) {
		ev.preventDefault();
		/** @type { { target: {elements: HTMLCollection & HTMLInputElement } } */
		const { target } = ev;
		const elements = target.elements;
		const fileInput = elements?.[1];
		const files = /** @type {FileList} */ (fileInput.files);

		if (!files?.length) {
			toast = ({ type: 'error', text: 'Por favor selecione um arquivo zip antes.' });
			return;
		}

		const file = files[0];
		if (!file.name.endsWith('.zip')) {
			toast = ({ type: 'error', text: 'Por favor confira a extensão do arquivo (.zip)' });
			return;
		}

		messages = null;
		result = null;
		toast = ({
			text: 'Iniciando Processamento',
			type: 'transcribe'
		});

		connectSocket();

		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`${PUBLIC_API_URL}/process?uid=${uuid}`, {
			method: 'POST',
			body: formData
		}).catch((e) => {
			console.error(e);
			toast = ({
				type: 'error',
				text: 'Erro ao Enviar o Arquivo, Verifique Sua Conexão.'
			});
		});
		if (!response) return;

		if (!response.ok) {
			toast = ({ type: 'error', text: verifyFileErr });
			console.error(`HTTP error! status: ${response.status}`);
		}

		result = await response.json();
		if (Array.isArray(result) && result.length > 0 && result[0].ERRO) {
			toast = ({ type: 'error', text: t[0].ERRO });
			return;
		} // else
		if (!Array.isArray(result) && result.Erro) {
			toast = ({ type: 'error', text: t.Erro });
			return;
		}
		messages = result;
		isApple = messages?.[0]?.IsApple;
		console.log('isapple '+ isApple)
		console.log(messages)
		processConversation(file);
	}

	/**
	 * Cria um arquivo zip com messages json para o back imprimir
	 * @param {File} file
	 * @return {Promise<File>}
	 */
	const addMessagesJson = async (file) => {
		JSZip ??= (await import('jszip')).default;
		const zip = new JSZip();
		const contents = await zip.loadAsync(file);
		contents.file('whats_organizer/messages.json', JSON.stringify(messages));
		const updatedFile = await zip.generateAsync({ type: 'blob' });
		return new File([updatedFile], file.name, { type: file.type });
	};

	/**
	 * Cria um arquivo zip com messages json para o back imprimir
	 * @param {File} file
	 * @return {Promise<Message[]>}
	 */
	const extractMessagesJson = async (file) => {
		JSZip ??= (await import('jszip')).default;
		const zip = new JSZip();
		const contents = await zip.loadAsync(file);

		const msgFile = contents.files['whats_organizer/messages.json'];
		return JSON.parse(await msgFile.async('text'));
	};

	async function generatePDF() {
		if (!chatContainer) {
			console.error('Chat container not found');
			toast = ({ type: 'error', text: 'Não há chat para imprimir' });
			return;
		}
		toast = ({
			text: 'Iniciando Impressão',
			type: 'print'
		});
		connectSocket();

		try {
			const formData = new FormData();
			const zipFile = files[0];
			const fileWithMessages = await addMessagesJson(zipFile);

			formData.append('file', fileWithMessages);

			const response = await fetch(`${PUBLIC_API_URL}/download-pdf`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				toast = ({ type: 'error', text: 'Erro ao gerar o PDF' });
				console.error(error, await response.text());
				return;
			}

			const blob = await response.blob();
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = 'chat.pdf';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			URL.revokeObjectURL(url);

			removeToast();
		} catch (e) {
			toast = ({ type: 'error', text: 'Erro ao Processar Requisição' });
			console.error(error, e);
		}
	}

	/** @param {SubmitEvent} ev */
	const handleMessageInjection = (ev) => {
		/** @type { { target: HTMLInputElement } } */
		const { target } = ev;
		const { value } = target || {};
		if (!value) return;
		messages = JSON.parse(value);
	};

	/**
	 * @param {string} filename
	 * @param {string} ext
	 * @returns {boolean}
	 */
	const isFile = (filename, ext) => filename?.endsWith?.(`.${ext}`);

	/** @param {string} filename */
	const isAudioFile = (filename) => isFile(filename, 'opus');

	/** @param {string} filename */
	const isVideoFile = (filename) => isFile(filename, 'mp4');

	/**
	 * @param {string} filename
	 * @param {string} ext
	 */
	const extIncludes = (filename, ext) => filename.toLowerCase().includes(`.${ext}`);

	/**
	 * @param {string} filename
	 * @param {string[]} files
	 */
	const isInFiles = (filename, files) => files.some((ext) => extIncludes(filename, ext));

	/** @param {string} filename */
	const isImgFile = (filename) => isInFiles(filename, ['jpg', 'jpeg', 'png']);

	/** @param {string} filename */
	const isWordFile = (filename) => isInFiles(filename, ['docx', 'docm']);

	/** @param {string} path */
	const getFileName = (path) => path.split('/').pop();

	/**
	 * Função utilizada pelo backend, pra injetar a conversa e gerar o PDF
	 * em um navegador simulado que roda no servidor (playwright)
	 * @param {Event & {currentTarget: EventTarget & HTMLInputElement}} e
	 */
	const handleBackendFileInjection = (e) => {
		/** @type { { target: HTMLInputElement } } */
		const { target } = e;
		const evFiles = target.files;
		/** @type {File} */
		const injectedFile = evFiles[0];
		extractMessagesJson(injectedFile).then((m) => (messages = m));
		processConversation(injectedFile);
	};

	/**
	 * Pega o lado do chat baseado em dispositivo (Apple/ Android)
	 * @param {boolean} isApple
	 */
	const getSideByDevice = (isApple) => (
		isApple ? ['left', 'right'] : ['right', 'left']
		)
</script>

<Toast {...toastProps} />
<main>
	<h1>WhatsOrganizer</h1>

	<p class="subtitle">
		Organize suas conversas de WhatsApp<br />
		e transcreva áudios de forma rápida e<br />
		segura de uma única vez
	</p>
	<form class="file-zip" on:submit={handleSubmit}>
		<UploadButton on:update={updateFiles} {loading} />
		<button type="submit" disabled={loading}>
			{loading ? 'Processando...' : 'Enviar'}
		</button>
	</form>

	<input
		data-testid="playwright-inject-media"
		type="file"
		accept=".zip"
		on:change={handleBackendFileInjection}
	/>

	{#if messages?.length}
		<div class="chat-container" data-testid="playwright-chat" bind:this={chatContainer}>
			{#each messages as message}
				{@const attachedPdfMsg = message.FileAttached && message.links}
				{@const isLongMessage = message?.links?.length > 4 || message?.Message?.length > 900}
				<div
					class="message-wrapper {getSideByDevice(isApple)[(message?.ID || 1) - 1]} {!isLongMessage
						? 'avoid-pdf-break'
						: ''}"
				>
					<div class="message-bubble">
						<div class="message-header">
							<span class="message-name">{message.Name}</span>
							<span class="message-time">{message.Date} {message.Time}</span>
						</div>
						{#if message.FileAttached}
							{#if attachedPdfMsg}
								<div class="filename">{getFileName(message.FileAttached)}</div>
								{#each message.links as link, index}
									{#if !(index % 2)}
										<img
											src={link}
											alt="Página do Documento Anexado"
											class="thumbnail-pdf avoid-pdf-break {message.links[index + 1] === 'landscape'
												? 'landscape'
												: 'portrait'}"
										/>
									{/if}
								{/each}
								<span class="small-description"
									>Imagens apenas ilustrativas, confira os arquivos originais, demonstrando no 6
									miniaturas máximo.</span
								>
							{/if}
							{#if isAudioFile(message.FileAttached)}
								<Audio
									filename={getFileName(message.FileAttached)}
									fileUrl={message.FileURL}
									audioTranscription={message.AudioTranscription}
								/>
							{:else if isImgFile(message.FileAttached)}
								<div class="filename">{getFileName(message.FileAttached)}</div>
								<img src={message.FileURL} alt="Mídia na Conversa" class="image-preview" />
							{:else if isVideoFile(message.FileAttached)}
								<Video fileURL={message.FileURL} />
							{:else if isWordFile(message.FileAttached)}
								<div class="filename">{getFileName(message.FileAttached)}</div>
							{/if}
							<!--
							@TODO Verificar se foto com legenda funciona
						    https://github.com/brpl20/whats-organizer-front/issues/5
							Acho que a mídia faz com que não apareça legenda
						 -->
						{:else}
							<p class="message-text">{message.Message}</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<p class="instructions">
		Faça o upload do seu arquivo exportado do WhatsApp<br />
		ele estará no formato .zip, confira como fazer:
	</p>
	<div class="platform-icons">
		<a
			href="https://faq.whatsapp.com/1180414079177245/?cms_platform=iphone&helpref=platform_switcher"
			class="platform-icon"
		>
			<img src="/apple.png" alt="Apple icon" class="icon-image icon-apple" />
		</a>
		<a href="https://faq.whatsapp.com/1180414079177245/?helpref=uf_share" class="platform-icon">
			<img src="/android.png" alt="Android icon" class="icon-image icon-android" />
		</a>
	</div>
	<div class="buttons">
		<button class="secondary" on:click={toggleLimitacoesModal}>Limitações</button>
		<button class="secondary" on:click={toggleLGPDModal}>LGPD</button>
	</div>

	{#if messages?.length}
		<button class="floating-button loading-button" on:click={generatePDF} disabled={loading}>
			{#if printLoading}
				<div class="spinner-container sm-spinner-container">
					<div class="spinner sm-spinner" />
				</div>
			{/if}
			Download PDF
		</button>
	{/if}
</main>

{#if showLimitacoesModal}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Fechar modal de limitações"
		on:click={toggleLimitacoesModal}
		on:keydown={(e) => toggleLimitacoesModal()}
	>
		<div class="modal" transition:fade>
			<h2>Limitações</h2>
			<ul>
				<li>- Grupos não suportados</li>
				<li>- Tamanho máximo dos arquivos: 40 Mb</li>
				<li>- Não confere garantia de autenticidade</li>
			</ul>
		</div>
	</div>
{/if}

{#if showLGPDModal}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Fechar modal de LGPD"
		on:click={toggleLGPDModal}
		on:keydown={(e) => toggleLGPDModal()}
	>
		<div class="modal" transition:fade>
			<h2>LGPD</h2>
			<p>
				Não coletamos nenhum dado e todos os arquivos são totalmente destruídos após as etapas do
				organizador serem concluídas.
			</p>
		</div>
	</div>
{/if}

<style>
	@media print {
		@page {
			size: A4;
			margin: 1cm 0;
			/* background-color: #e5ddd5; */
		}

		* {
			-webkit-print-color-adjust: exact !important;
			print-color-adjust: exact !important;
			color-adjust: exact !important;
		}

		main > :not(.chat-container) {
			display: none !important;
		}

		main {
			margin: 0 auto !important;
			padding: 0 !important;
			background-color: unset !important;
		}

		.chat-container {
			margin: 0 !important;
		}

		.avoid-pdf-break {
			break-inside: avoid;
		}

		[data-testid='playwright-inject-media'] {
			display: none !important;
		}
	}

	[data-testid='playwright-inject-media'] {
		display: none;
	}

	* {
		font-family: Arial, sans-serif;
		list-style-type: none;
	}

	.spinner-container,
	.file-zip :global(.spinner-container) {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		text-align: center;
	}
	.spinner,
	.file-zip :global(.spinner) {
		width: 50px;
		aspect-ratio: 1;
		display: grid;
		border: 4px solid #0000;
		border-radius: 50%;
		border-right-color: #005c4b;
		animation: l15 1s infinite linear;
	}
	.spinner::before,
	.spinner::after,
	.file-zip :global(.spinner::after),
	.file-zip :global(.spinner::before) {
		content: '';
		grid-area: 1/1;
		margin: 2px;
		border: inherit;
		border-radius: 50%;
		animation: l15 2s infinite;
	}
	.spinner::after,
	.file-zip :global(.spinner::after) {
		margin: 8px;
		animation-duration: 3s;
	}

	.sm-spinner-container {
		height: 10px;
		width: 44px;
		margin: 0 12px 0 0;
	}

	.sm-spinner::after {
		margin: 0px;
		animation-duration: 2s;
	}
	@keyframes l15 {
		100% {
			transform: rotate(1turn);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	main {
		max-width: 600px;
		margin: 0 auto;
		padding: 20px;
		text-align: center;
		background-color: #58f1c4;
		color: #1c1c1c;
		border-radius: 10px;
	}

	h1 {
		font-size: 3em;
		margin-bottom: 10px;
		font-family: 'Alfa Slab One', system-ui;
		font-weight: 700;
		text-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
		color: #005c4b;
	}

	.subtitle,
	.instructions {
		margin-bottom: 20px;
		color: #005c4b;
	}

	button {
		padding: 18px 30px;
		border: none;
		border-radius: 5px;
		background-color: #1c1c1c;
		color: white;
		cursor: pointer;
		font-size: 15px;
	}

	.platform-icons {
		display: flex;
		justify-content: center;
		gap: 1rem;
		align-items: center;
		margin: 15px;
	}

	.platform-icon {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background-color: #f0f0f0;
		transition: background-color 0.3s ease;
	}

	.platform-icon:hover {
		background-color: #145c4b;
	}

	.icon-image {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}

	.buttons {
		display: flex;
		justify-content: center;
		gap: 20px;
		margin-bottom: 20px;
	}

	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		color: #1c1c1c;
	}

	.modal {
		background-color: white;
		padding: 20px;
		border-radius: 5px;
		max-width: 400px;
		text-align: left;
		border-top: 3px solid;
		border-image: linear-gradient(to right, #00f38d, #00b4f3) 1;
		font-size: 18px;
	}

	.modal h2 {
		margin-top: 0;
	}

	.modal ul {
		padding-left: 20px;
		list-style-type: none;
	}

	.chat-container {
		max-width: 100%;
		margin: 20px 0;
		padding: 20px 20px 25px 20px;
		background-color: #e5ddd5;
		border-radius: 10px;
		text-align: left;
	}

	.message-wrapper {
		display: flex;
		flex-direction: column;
		padding: 12px 0 0 0;
	}

	.left {
		align-items: flex-start;
	}

	.right {
		align-items: flex-end;
	}

	.message-bubble {
		max-width: 70%;
		padding: 10px;
		border-radius: 10px;
		background-color: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.left .message-bubble {
		background-color: #ffffff;
	}

	.right .message-bubble {
		background-color: #dcf8c6;
	}

	.message-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 5px;
		font-size: 0.8em;
	}

	.message-name {
		font-weight: bold;
	}

	.message-time {
		color: #999;
		padding-left: 0.3em;
	}

	.message-text {
		margin: 0;
		hyphens: auto;
		-moz-hyphens: auto;
		word-wrap: break-word;
	}

	.filename {
		font-size: 0.8em;
		color: #666;
		margin-bottom: 5px;
	}

	.image-preview {
		width: 100px;
		height: auto;
		transition: transform 0.3s ease;
	}

	.image-preview:hover {
		transform: scale(3.5);
		z-index: 9;
	}

	.thumbnail-pdf {
		width: 200px;
		height: 200px;
		object-fit: cover;
		padding: 5px;
	}

	.thumbnail-pdf.landscape {
		width: 300px;
		height: 150px;
		transition: transform 0.3s ease;
	}

	.thumbnail-pdf.portrait {
		width: 150px;
		height: 200px;
		transition: transform 0.3s ease;
	}

	.thumbnail-pdf.landscape:hover {
		transform: scale(3.5);
		z-index: 9;
	}

	.thumbnail-pdf.portrait:hover {
		transform: scale(3.5);
		z-index: 9;
	}

	.small-description {
		font-size: 12px;
		color: #666;
		font-style: italic;
		line-height: 1.4;
		max-width: 300px;
		padding: 8px 12px;
		background-color: #f5f5f5;
		border-left: 3px solid #ccc;
		margin: 10px 0;
		display: inline-block;
	}

	.loading-button {
		display: flex;
	}

	.floating-button {
		z-index: 1;
		position: fixed;
		bottom: 20px;
		left: 40vw;
		background-color: #1c1c1c;
		color: white;
		border: none;
		border-radius: 5%;
		padding: 25px;
		cursor: pointer;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
		font-size: 17px;
	}

	@media (min-width:320px)  {
		.floating-button {
			top: 90vh;
			bottom: unset;
			margin: -20px 28px;
		}
	}
</style>
