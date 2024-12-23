<script>
	import { fade } from 'svelte/transition';
	import Pre from '$lib/Pre.svelte';
	import { PUBLIC_API_URL } from '$env/static/public';
	import UploadButton from './UploadButton.svelte';
	import {onDestroy} from 'svelte'
	import Video from './ChatComponents/Video.svelte';
	import { browser } from '$app/environment';

	const socketConnTimeout = 5000

	/** @type {HTMLDivElement=}*/
	let chatContainer = null;
	/**
	 * @typedef {object} ApiResult
  	 * @property {string} Date
  	 * @property {string|false} FileAttached
  	 * @property {number} ID
  	 * @property {string} Message
  	 * @property {string} Name
  	 * @property {string} Time
	 * @property {string=} ERRO
	 */
	/** @type {ApiResult[]=} */
	let result = null;
	let isLoading = false;
	/** @type {string=}*/
	let error = null;
	/** @type {string=}*/
	let printError = null;
	let showLimitacoesModal = false;
	let showLGPDModal = false;
	let messages = [];
	/** @type {string[]} */
	let socketMessages = [];
	let showPDFButton = false;

	$: if (browser && !messages.length) messages = window.messages ?? []

	/** Optimize import on-demand for heavy libs */
	/** @type {import('jszip')=} */
	let JSZip = null
	/** @type {import('mammoth')=} */
	let mammoth = null
	/** @type {import('socket.io-client').default=}*/
	let io = null
	/** @type {import('jspdf').default=} */
	let jsPDF = null
	/** @type {import('html2canvas')=} */
	let html2canvas = null;

	/** @type {import('socket.io-client').Socket<DefaultEventsMap, DefaultEventsMap>=}*/
	let socket = null;

	onDestroy(() => socket?.disconnect?.())

	const toggleLimitacoesModal = () => showLimitacoesModal = !showLimitacoesModal;

	const toggleLGPDModal = () => showLGPDModal = !showLGPDModal;

	async function processZipFile(file) {
		JSZip ??= ((await import('jszip')).default)
		const zip = new JSZip();
		const contents = await zip.loadAsync(file);

		for (let [filename, zipEntry] of Object.entries(contents.files)) {
			const arrayBuffer = await zipEntry.async('arraybuffer');
			const blob = new Blob([arrayBuffer], { type: getFileType(filename) });
			const url = URL.createObjectURL(blob);

			messages = await Promise.all(
				messages.map(async (msg) => {
					if (msg.FileAttached === filename) {
						const fileInfo = await getFileInfo(blob, filename);
						return { ...msg, FileURL: url, ...fileInfo };
					}
					return msg;
				})
			);
		}
	}

	/** @param {string} filename */
	function getFileType(filename) {
		const ext = filename.split('.').pop().toLowerCase();
		switch (ext) {
			case 'pdf':
				return 'application/pdf';
			case 'docx':
			case 'docm': // docx + macros enabled
				return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
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
	 * @param {string} filename
	 */
	async function getFileInfo(blob, filename) {
		const ext = filename.split('.').pop().toLowerCase();
		switch (ext) {
			case 'pdf':
				return { type: 'pdf' };
			case 'docx':
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

	async function getDocxInfo(blob) {
		const arrayBuffer = await blob.arrayBuffer();
		mammoth ??= (await import('mammoth'))
		const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
		const text = htmlResult.value;
		const pages = text.split('\n\n').slice(0, 6);
		return { type: 'docx', pages };
	}

	async function getImageInfo(blob) {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve({ type: 'image', width: img.width, height: img.height });
			img.src = URL.createObjectURL(blob);
		});
	}

	async function getVideoInfo(blob) {
		return new Promise((resolve) => {
			const video = document.createElement('video');
			video.onloadedmetadata = () => {
				const canvas = document.createElement('canvas');
				canvas.width = video.videoWidth;
				canvas.height = video.videoHeight;
				canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
				const thumbnail = canvas.toDataURL();
				resolve({ type: 'video', duration: video.duration, thumbnail });
			};
			video.src = URL.createObjectURL(blob);
		});
	}

	async function connectSocket() {
		socketMessages = []
		if (socket) return;

		io ??= (await import('socket.io-client')).default
		socket ??= io(PUBLIC_API_URL, {
			reconnectionAttempts: 5,
			transports: ['websocket', 'polling', 'webtransport'],
			timeout: socketConnTimeout,
		});

		/** @type {Promise<void>} */
		const connect = new Promise((resolve, _) => (
			socket.on('connect', resolve))
		)
		/** @type {Promise<void>} */
		const timeout = new Promise((_, reject) => setTimeout(() => (
			reject(new Error('Connection timed out'))
		), socketConnTimeout));

		try {
			Promise.race([connect, timeout])
		} catch (e) {
			socketMessages = ["Carregando..."]
			console.error(e)
		}

		socket.on('Smessage', (data) => {
			console.log('Server message:', data);
			if (!(data?.data)) return;
			socketMessages = [...socketMessages, data.data];
		});
	}

	/** @param {SubmitEvent} ev */
	async function handleSubmit(ev) {
		ev.preventDefault();
		const elements = /** @type {HTMLFormControlsCollection} */(ev.target.elements)
		const fileInput = elements?.[1]
		const files = /** @type {FileList} */(fileInput.files)


		if (!files?.length) {
			error = 'Por favor selecione um arquivo zip antes.';
			return;
		}

		const file = files[0];
		if (!file.name.endsWith('.zip')) {
			error = 'Please select a ZIP file.';
			return;
		}


		error = null;
		printError = null
		isLoading = true;
		result = null;

		await connectSocket()

		const formData = new FormData();
		formData.append('file', file);

		try {
			const response = await fetch(`${PUBLIC_API_URL}/process`, {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			result = await response.json();
			if (Array.isArray(result) && result.length > 0 && result[0].ERRO) {
				error = result[0].ERRO;
				return
			} // else
			if (!Array.isArray(result) && result.Erro) {
        	  error = result.Erro
        	  return
        	}
			messages = result;
			await processZipFile(file);
			showPDFButton = true;
		} catch (e) {
			console.error('Houve um erro ao processar o arquivo:', e);
			error = 'Houve um erro ao processar o arquivo. Por favor Tente Novamente.';
		} finally {
			isLoading = false;
		}
	}

	async function generatePDF() {
    let printError = null;

    if (!chatContainer) {
        console.error('Chat container not found');
        printError = 'Não há chat para imprimir';
        return;
    }

    try {
        const response = await fetch(`${PUBLIC_API_URL}/download-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages }),
        });

        if (!response.ok) {
            printError = 'Erro ao gerar o PDF';
            console.error(printError, await response.text());
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
    } catch (error) {
        printError = 'Erro ao conectar ao servidor';
        console.error(printError, error);
    }
}


	/**
	 * @param {string} filename
	 * @param {string} ext
	 * @returns {boolean}
	 */
	const isFile = (filename, ext) => filename?.endsWith?.(`.${ext}`)

	/** @param {string} filename */
	const isAudioFile = (filename) => isFile(filename, 'opus')

	/** @param {string} filename */
	const isVideoFile = (filename) => isFile(filename, 'mp4')

	/** @param {string} path */
	const getFileName = (path) => path.split('/').pop()


</script>

<main>
	<h1>WhatsOrganizer</h1>

	<p class="subtitle">
		Organize suas conversas de WhatsApp<br />
		e transcreva áudios de forma rápida e<br />
		segura de uma única vez
	</p>
	{#if isLoading}
		<div class="spinner-container">
			<div class="spinner"></div>
			<h2>Processando...</h2>
		</div>
		<ul>
			{#each socketMessages as smessage}
				<li class="smessage-li">{smessage}</li>
			{/each}
		</ul>
	{/if}
		<form class="file-zip" on:submit={handleSubmit}>
			<UploadButton />
			<button type="submit" disabled={isLoading}>
				{isLoading ? 'Processando...' : 'Enviar'}
			</button>
		</form>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	{#if printError}
	<p class="error">{error}</p>
{/if}

	{#if messages.length > 0}
		<div class="chat-container" bind:this={chatContainer}>
			{#each messages as message}
				<div class="message-wrapper {message.ID === 1 ? 'left' : 'right'}">
					<div class="message-bubble">
						<div class="message-header">
							<span class="message-name">{message.Name}</span>
							<span class="message-time">{message.Time}</span>
						</div>
						{#if message.FileAttached !== false}
							{#if message.FileAttached}
								{#if message.links}
									<div class="thumbnails">
										<div class="filename">{getFileName(message.FileAttached)}</div>
										{#each message.links as link, index}
											{#if index % 2 === 0}
												<div class="thumbnail-container">
													<img
														src={link}
														alt="PDF"
														class="thumbnail-pdf {message.links[index + 1] === 'landscape'
															? 'landscape'
															: 'portrait'}"
													/>
												</div>
											{/if}
										{/each}
										<span class="small-description"
											>Imagens apenas ilustrativas, confira os arquivos originais, demonstrando no 6
											miniaturas máximo.</span
										>
									</div>
								{/if}
								{#if message.FileAttached.toLowerCase().includes('.docx')}
									<div class="filename">{getFileName(message.FileAttached)}</div>
								{/if}

								{#if isAudioFile(message.FileAttached)}
									<div class="audio-message">
										<div class="audio-filename">{getFileName(message.FileAttached)}</div>
										<audio controls src={message.FileURL}></audio>
										{#if message.AudioTranscription}
											<div class="transcription">
												{message.AudioTranscription}
											</div>
										{/if}
									</div>
								{/if}

								{#if message.FileAttached.toLowerCase().includes('.mp4')}
									<Video fileURL={message.FileURL} />
								{/if}

								{#if message.FileAttached.toLowerCase().includes('.jpg') || message.FileAttached.toLowerCase().includes('.jpeg') || message.FileAttached.toLowerCase().includes('.png')}
									<div class="filename">{getFileName(message.FileAttached)}</div>
									<img src={message.FileURL} alt="Mídia na Conversa" class="image-preview" />
								{/if}
							{/if}
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

	{#if showPDFButton}
		<button class="floating-button" on:click={generatePDF}> Download PDF </button>
	{/if}
	<Pre />
</main>

{#if showLimitacoesModal}
	<div 
		class="modal-backdrop" 
		role="button" 
		tabindex="0" 
		aria-label="Fechar modal de limitações" 
		on:click={toggleLimitacoesModal} 
		on:keydown={(e) => toggleLimitacoesModal()}>
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
		on:keydown={(e) => toggleLGPDModal()}>
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
            margin: 1cm;
        }

		main>:not(.chat-container) {
			display: none !important;
		}

		main {
			background-color: unset !important;
		}

		.message-bubble {
			break-inside: avoid;
		}
	}

	* {
		font-family: Arial, sans-serif;
		list-style-type: none;
	}
	.smessage-li {
		text-align: center;
	}
	.spinner-container {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		text-align: center;
	}
	.spinner {
		width: 50px;
		aspect-ratio: 1;
		display: grid;
		border: 4px solid #0000;
		border-radius: 50%;
		border-right-color: #005c4b;
		animation: l15 1s infinite linear;
	}
	.spinner::before,
	.spinner::after {
		content: '';
		grid-area: 1/1;
		margin: 2px;
		border: inherit;
		border-radius: 50%;
		animation: l15 2s infinite;
	}
	.spinner::after {
		margin: 8px;
		animation-duration: 3s;
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

	.error {
		color: red;
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
		padding: 20px;
		background-color: #e5ddd5;
		border-radius: 10px;
		text-align: left;
	}

	.message-wrapper {
		display: flex;
		flex-direction: column;
		margin-bottom: 10px;
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
	}

	.audio-message audio {
		width: 100%;
		border-radius: 20px;
	}

	.audio-filename {
		font-size: 0.8em;
		color: #666;
		margin-bottom: 5px;
	}

	.filename {
		font-size: 0.8em;
		color: #666;
		margin-bottom: 5px;
	}

	.transcription {
		margin-top: 5px;
		font-style: italic;
		color: #666;
	}

	.image-preview {
		width: 100px;
		height: auto;
		transition: transform 0.3s ease;
	}

	.image-preview:hover {
		transform: scale(3.5);
		z-index: 10;
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
		z-index: 10;
	}

	.thumbnail-pdf.portrait:hover {
		transform: scale(3.5);
		z-index: 10;
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

	.floating-button {
		position: fixed;
		bottom: 20px;
		right: 20px;
		background-color: #1c1c1c;
		color: white;
		border: none;
		border-radius: 5%;
		padding: 25px;
		cursor: pointer;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
		font-size: 17px;
	}
</style>
