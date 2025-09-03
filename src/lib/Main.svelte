<script>
	import { fade } from 'svelte/transition';
	import { PUBLIC_API_URL, PUBLIC_NODE_ENV } from '$env/static/public';
	import UploadButton from './UploadButton.svelte';
	import { onDestroy } from 'svelte';
	import Video from './ChatComponents/Video.svelte';
	import Audio from './ChatComponents/Audio.svelte';
	import Toast from './Toast.svelte';
	import TranscribeSvg from './TranscribeSvg.svelte';
	import PrintSvg from './PrinterSvg.svelte';
	import ErrorSvg from './ErrorSvg.svelte';
	import { MessageCircle, FileText, X, Download } from 'lucide-svelte';

	/**
	 * @typedef {import('./types/toast.type.js').ToastTypes} ToastTypes
	 * @typedef {import('./types/toast.type.js').ToastProps} ToastProps
	 * @typedef {import('jszip')=} JsZip
	 * @typedef {import('mammoth')=} Mammoth
	 * @typedef {import('socket.io-client').default=} SocketIo
	 * @typedef {import('socket.io-client').Socket<DefaultEventsMap, DefaultEventsMap>=} SocketType
	 */

	const prod = (PUBLIC_NODE_ENV || '').toLowerCase() in ['prod', 'production'];

	/** Timeout caso o socketio não consiga conectar */
	const socketConnTimeout = 5000;

	const uuid = crypto.randomUUID();

	/** @type {HTMLDivElement=}*/
	let chatContainer = null;

	/** @type {string=}*/
	let showLimitacoesModal = false;
	let showLGPDModal = false;
	let showMediaModal = false;

	/**
	 * @typedef {object} MediaModalData
	 * @property {string} type - 'image' | 'pdf'
	 * @property {string} src - URL da mídia
	 * @property {string} filename - Nome do arquivo
	 * @property {string[]=} links - Para PDFs com múltiplas páginas
	 */
	/** @type {MediaModalData=} */
	let currentMedia = null;

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

	onDestroy(() => (prod ? socket?.disconnect?.() : () => undefined));

	const toggleLimitacoesModal = () => (showLimitacoesModal = !showLimitacoesModal);

	const toggleLGPDModal = () => (showLGPDModal = !showLGPDModal);

	const toggleMediaModal = () => {
		showMediaModal = !showMediaModal;
		if (!showMediaModal) {
			currentMedia = null;
		}
	};

	/**
	 * @param {string} src
	 * @param {string} filename
	 * @param {string} type
	 * @param {string[]=} links
	 */
	const openMediaModal = (src, filename, type, links = null) => {
		currentMedia = { src, filename, type, links };
		showMediaModal = true;
	};

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
				toast = {
					type: 'error',
					text: verifyFileErr
				};
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
		if (!prod) return;
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
			toast = { ...toast, text: data.data };
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
			toast = { type: 'error', text: 'Por favor selecione um arquivo zip antes.' };
			return;
		}

		const file = files[0];
		if (!file.name.endsWith('.zip')) {
			toast = { type: 'error', text: 'Por favor confira a extensão do arquivo (.zip)' };
			return;
		}

		messages = null;
		result = null;
		toast = {
			text: 'Iniciando Processamento',
			type: 'transcribe'
		};

		connectSocket();

		const formData = new FormData();
		formData.append('file', file);

		const response = await fetch(`${PUBLIC_API_URL}/process?uid=${uuid}`, {
			method: 'POST',
			body: formData
		}).catch((e) => {
			console.error(e);
			toast = {
				type: 'error',
				text: 'Erro ao Enviar o Arquivo, Verifique Sua Conexão.'
			};
		});
		if (!response) return;

		if (!response.ok) {
			// Try to get error message from response
			try {
				const errorData = await response.json();
				if (errorData.Erro) {
					// Check if it's a security error
					if (
						errorData.Erro.includes('MALICIOSO') ||
						errorData.Erro.includes('malicious') ||
						errorData.Erro.includes('perigosos')
					) {
						toast = {
							type: 'error',
							text: `⚠️ ARQUIVO PERIGOSO DETECTADO!\n\n${errorData.Erro}\n\nPor favor, verifique o conteúdo do arquivo ZIP e remova quaisquer arquivos suspeitos antes de tentar novamente.`
						};
					} else {
						toast = { type: 'error', text: errorData.Erro };
					}
				} else {
					toast = { type: 'error', text: verifyFileErr };
				}
			} catch (e) {
				toast = { type: 'error', text: verifyFileErr };
			}
			console.error(`HTTP error! status: ${response.status}`);
			return;
		}

		result = await response.json();
		if (Array.isArray(result) && result.length > 0 && result[0].ERRO) {
			toast = { type: 'error', text: result[0].ERRO };
			return;
		} // else
		if (!Array.isArray(result) && result.Erro) {
			// Check if it's a security error
			if (
				result.Erro.includes('MALICIOSO') ||
				result.Erro.includes('malicious') ||
				result.Erro.includes('perigosos')
			) {
				toast = {
					type: 'error',
					text: `⚠️ ARQUIVO PERIGOSO DETECTADO!\n\n${result.Erro}\n\nPor favor, verifique o conteúdo do arquivo ZIP e remova quaisquer arquivos suspeitos antes de tentar novamente.`
				};
			} else {
				toast = { type: 'error', text: result.Erro };
			}
			return;
		}
		messages = result;
		isApple = messages?.[0]?.IsApple;
		console.log('isapple ' + isApple);
		console.log(messages);
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
			toast = { type: 'error', text: 'Não há chat para imprimir' };
			return;
		}
		toast = {
			text: 'Iniciando Impressão',
			type: 'print'
		};
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
				toast = { type: 'error', text: 'Erro ao gerar o PDF' };
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
			toast = { type: 'error', text: 'Erro ao Processar Requisição' };
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
	const getSideByDevice = (isApple) => (isApple ? ['left', 'right'] : ['right', 'left']);
</script>

<Toast {...toastProps} />
<main
	class="min-h-screen bg-gradient-to-br from-emerald-400 via-teal-500 to-blue-600 relative overflow-hidden"
>
	<!-- Fundo decorativo -->
	<div class="absolute inset-0 bg-black/5"></div>
	<div class="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
	<div class="absolute bottom-20 right-10 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl"></div>

	<div class="relative z-10 container mx-auto px-4 py-12">
		<!-- Header -->
		<div class="text-center mb-16 animate-fade-in">
			<div class="text-center mb-16 animate-fade-in">
				<div class="flex justify-center items-center mb-6">
					<div
						class="bg-white/20 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/30"
					>
						<MessageCircle class="w-12 h-12 text-white" />
					</div>
				</div>
				<h1 class="text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight">
					WhatsOrganizer
				</h1>
				<p class="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed font-light">
					Organize suas conversas de WhatsApp e transcreva áudios de forma rápida e segura
				</p>
			</div>

			<!-- Upload Card -->
			<div class="max-w-2xl mx-auto mb-12">
				<!-- <div class="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12"> -->
				<div class="">
					<form class="file-zip space-y-6" on:submit={handleSubmit} data-testid="file-upload-form">
						<UploadButton on:update={updateFiles} {loading} />

						<!-- <button
						type="submit"
						class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-4 px-12 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 text-lg"
						disabled={loading}
					>
						{loading ? 'Processando...' : 'Enviar'}
					</button> -->
					</form>
				</div>
			</div>

			<!-- NAO REMOVA ESSA INPUT, ELA É USADA PRA GERAR O PDF -->
			<input
				data-testid="playwright-inject-media"
				type="file"
				accept=".zip"
				on:change={handleBackendFileInjection}
				class="hidden"
			/>
			<!-- Chat renderizado - DESIGN MODERNIZADO -->
			{#if messages?.length}
				<div
					class="chat-container relative bg-gradient-to-b from-slate-50/95 to-white/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/60 mb-12 max-h-[75vh] overflow-hidden"
					data-testid="playwright-chat"
					bind:this={chatContainer}
				>
					<!-- Header do Chat -->
					<div
						class="sticky top-0 z-10 bg-gradient-to-r from-emerald-500/90 to-teal-500/90 backdrop-blur-xl p-6 border-b border-white/20"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center space-x-3">
								<div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
									<MessageCircle class="w-6 h-6 text-white" />
								</div>
								<div>
									<h3 class="text-lg font-semibold text-white">Conversa Organizada</h3>
									<p class="text-sm text-white/80">{messages.length} mensagens processadas</p>
								</div>
							</div>
							<div class="flex items-center space-x-2">
								<div class="px-3 py-1 bg-white/20 rounded-full">
									<span class="text-xs font-medium text-white">{isApple ? 'iOS' : 'Android'}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Container das mensagens -->
					<div
						class="message-container p-6 space-y-4 overflow-y-auto max-h-[calc(75vh-100px)] scroll-smooth"
					>
						{#each messages as message, index}
							{@const attachedPdfMsg = message.FileAttached && message.links}
							{@const isLongMessage = message?.links?.length > 4 || message?.Message?.length > 900}
							{@const isOutgoing = getSideByDevice(isApple)[(message?.ID || 1) - 1] === 'right'}

							<div
								class="message-wrapper animate-slide-in"
								style="animation-delay: {index * 0.05}s"
							>
								<div class="flex {isOutgoing ? 'justify-end' : 'justify-start'} mb-3">
									<div class="max-w-[75%] sm:max-w-[85%] group">
										<!-- Bubble da mensagem -->
										<div
											class="relative {isOutgoing
												? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-[24px] rounded-br-[8px]'
												: 'bg-white text-gray-800 rounded-[24px] rounded-bl-[8px] border border-gray-100'} 
										p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
										>
											<!-- Header da mensagem -->
											<div class="flex justify-between items-center mb-2">
												<span
													class="text-sm font-semibold {isOutgoing
														? 'text-emerald-100'
														: 'text-emerald-600'}"
												>
													{message.Name}
												</span>
												<span
													class="text-xs {isOutgoing
														? 'text-emerald-200/80'
														: 'text-gray-400'} ml-3"
												>
													{message.Date} • {message.Time}
												</span>
											</div>

											<!-- Conteúdo da mensagem -->
											<div class="message-content w-full min-w-0">
												{#if message.FileAttached}
													<!-- Anexos PDF -->
													{#if attachedPdfMsg}
														<div class="mb-3">
															<div
																class="flex items-center space-x-2 mb-3 p-2 {isOutgoing
																	? 'bg-white/10'
																	: 'bg-gray-50'} rounded-lg"
															>
																<FileText
																	class="w-4 h-4 {isOutgoing
																		? 'text-white'
																		: 'text-gray-600'} flex-shrink-0"
																/>
																<span
																	class="text-sm {isOutgoing
																		? 'text-white/90'
																		: 'text-gray-600'} truncate"
																>
																	{getFileName(message.FileAttached)}
																</span>
															</div>
															<!-- Grid de imagens do PDF -->
															<div class="grid grid-cols-2 gap-2 mb-3">
																{#each message.links as link, linkIndex}
																	{#if !(linkIndex % 2) && message.links[linkIndex + 1] !== 'pdf'}
																		<div
																			class="relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105"
																			on:click={() =>
																				openMediaModal(
																					link,
																					getFileName(message.FileAttached),
																					'pdf',
																					message.links
																				)}
																			on:keydown={(e) =>
																				e.key === 'Enter' &&
																				openMediaModal(
																					link,
																					getFileName(message.FileAttached),
																					'pdf',
																					message.links
																				)}
																			tabindex="0"
																			role="button"
																			aria-label="Visualizar PDF em tamanho maior"
																		>
																			<img
																				src={link}
																				alt="Página do Documento"
																				class="w-full h-24 object-cover"
																			/>
																			<div
																				class="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
																			>
																				<div class="bg-white/90 rounded-full p-2">
																					<FileText class="w-4 h-4 text-gray-700" />
																				</div>
																			</div>
																		</div>
																	{/if}
																{/each}
															</div>
															<!-- Link para PDF completo -->
															{#if message.links && message.links.length >= 2 && message.links[1] === 'pdf'}
																<a
																	href={message.links[0]}
																	target="_blank"
																	rel="noopener noreferrer"
																	class="inline-flex items-center space-x-1 text-sm {isOutgoing
																		? 'text-white hover:text-emerald-100'
																		: 'text-emerald-600 hover:text-emerald-700'} underline underline-offset-2 hover:no-underline transition-colors"
																>
																	<FileText class="w-3 h-3 flex-shrink-0" />
																	<span class="truncate">Baixar PDF completo</span>
																</a>
															{/if}
														</div>
													{/if}

													<!-- Arquivos de áudio -->
													{#if isAudioFile(message.FileAttached)}
														<div class="mb-2 w-full max-w-full overflow-hidden">
															<div class="w-full max-w-full">
																<Audio
																	filename={getFileName(message.FileAttached)}
																	fileUrl={message.FileURL}
																	audioTranscription={message.AudioTranscription}
																/>
															</div>
														</div>
														<!-- Imagens -->
													{:else if isImgFile(message.FileAttached)}
														<div class="mb-2">
															<div
																class="relative overflow-hidden rounded-lg shadow-lg max-w-xs cursor-pointer transform hover:scale-105 transition-all duration-300"
																on:click={() =>
																	openMediaModal(
																		message.FileURL,
																		getFileName(message.FileAttached),
																		'image'
																	)}
																on:keydown={(e) =>
																	e.key === 'Enter' &&
																	openMediaModal(
																		message.FileURL,
																		getFileName(message.FileAttached),
																		'image'
																	)}
																tabindex="0"
																role="button"
																aria-label="Visualizar imagem em tamanho maior"
															>
																<img
																	src={message.FileURL}
																	alt="Mídia compartilhada"
																	class="w-full h-auto object-cover"
																/>
																<div
																	class="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
																>
																	<div class="bg-white/90 rounded-full p-3">
																		<div class="w-4 h-4 border-2 border-gray-700 rounded-sm"></div>
																	</div>
																</div>
															</div>
														</div>
														<!-- Vídeos -->
													{:else if isVideoFile(message.FileAttached)}
														<div class="mb-2">
															<div class="rounded-lg overflow-hidden shadow-lg max-w-xs">
																<Video fileURL={message.FileURL} />
															</div>
														</div>
														<!-- Arquivos Word -->
													{:else if isWordFile(message.FileAttached)}
														<div
															class="flex items-center space-x-2 p-2 {isOutgoing
																? 'bg-white/10'
																: 'bg-gray-50'} rounded-lg"
														>
															<FileText
																class="w-4 h-4 {isOutgoing
																	? 'text-white'
																	: 'text-gray-600'} flex-shrink-0"
															/>
															<span
																class="text-sm {isOutgoing
																	? 'text-white/90'
																	: 'text-gray-600'} truncate"
															>
																{getFileName(message.FileAttached)}
															</span>
														</div>
													{/if}
												{:else}
													<!-- Mensagem de texto -->
													<div class="text-sm leading-relaxed whitespace-pre-wrap break-words">
														{message.Message}
													</div>
												{/if}
											</div>

											<!-- Indicador de lida (apenas para mensagens enviadas) -->
											{#if isOutgoing}
												<div class="flex justify-end mt-2">
													<div class="flex space-x-1">
														<div class="w-1 h-1 bg-emerald-200 rounded-full"></div>
														<div class="w-1 h-1 bg-emerald-200 rounded-full"></div>
													</div>
												</div>
											{/if}
										</div>
									</div>
								</div>
							</div>
						{/each}
					</div>

					<!-- Footer do chat -->
					<div
						class="sticky bottom-0 bg-gradient-to-r from-gray-50/90 to-white/90 backdrop-blur-xl p-4 border-t border-gray-200/50"
					>
						<div class="flex justify-center">
							<div class="flex items-center space-x-2 text-xs text-gray-500">
								<div class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
								<span>Conversa processada e organizada</span>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Instruções -->
			<div class="max-w-3xl mx-auto mb-12">
				<div class="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8">
					<h3 class="text-xl font-bold text-gray-800 mb-3">Como usar o WhatsOrganizer</h3>
					<p class="text-gray-600 leading-relaxed">
						Faça o upload do seu arquivo exportado do WhatsApp em formato <b>.zip</b>.
					</p>
					<div class="flex justify-center gap-6 mt-6">
						<a
							href="https://faq.whatsapp.com/1180414079177245/?cms_platform=iphone&helpref=platform_switcher"
							class="bg-gray-200 p-4 rounded-full hover:bg-emerald-100 transition"
						>
							<img src="/apple.png" alt="Apple" class="w-8 h-8" />
						</a>
						<a
							href="https://faq.whatsapp.com/1180414079177245/?helpref=uf_share"
							class="bg-gray-200 p-4 rounded-full hover:bg-emerald-100 transition"
						>
							<img src="/android.png" alt="Android" class="w-8 h-8" />
						</a>
					</div>
				</div>
			</div>

			<!-- Botões extra -->
			<div class="text-center space-x-4">
				<button
					class="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white font-semibold py-3 px-6 rounded-xl border border-white/30 transition-all duration-300 hover:scale-105"
					on:click={toggleLimitacoesModal}
					data-tetstid="limitacoes-btn"
				>
					Limitações
				</button>
				<button
					class="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white font-semibold py-3 px-6 rounded-xl border border-white/30 transition-all duration-300 hover:scale-105"
					on:click={toggleLGPDModal}
					data-tetstid="lgpd-btn"
				>
					LGPD
				</button>
			</div>

			<!-- Floating PDF download -->
			{#if messages?.length}
				<button
					class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-4 px-10 rounded-2xl shadow-lg hover:scale-105 transition transform"
					on:click={generatePDF}
					disabled={loading}
				>
					{#if printLoading}
						<span
							class="animate-spin inline-block mr-2 w-5 h-5 border-2 border-white border-t-transparent rounded-full"
						></span>
					{/if}
					Download PDF
				</button>
			{/if}
		</div>

		<!-- Modal de Mídia -->
		{#if showMediaModal && currentMedia}
			<div
				class="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4"
				on:click={toggleMediaModal}
				transition:fade={{ duration: 300 }}
			>
				<div
					class="relative bg-white rounded-2xl shadow-2xl max-w-6xl max-h-[90vh] overflow-hidden"
					on:click|stopPropagation
				>
					<!-- Header do Modal -->
					<div
						class="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
					>
						<div class="flex items-center space-x-3 min-w-0 flex-1">
							<FileText class="w-5 h-5 flex-shrink-0" />
							<span class="font-semibold truncate">{currentMedia.filename}</span>
						</div>
						<div class="flex items-center space-x-2 flex-shrink-0">
							{#if currentMedia.type === 'pdf' && currentMedia.links && currentMedia.links.length >= 2 && currentMedia.links[1] === 'pdf'}
								<a
									href={currentMedia.links[0]}
									target="_blank"
									rel="noopener noreferrer"
									class="p-2 hover:bg-white/20 rounded-lg transition-colors"
									title="Baixar PDF completo"
								>
									<Download class="w-5 h-5" />
								</a>
							{/if}
							<button
								on:click={toggleMediaModal}
								class="p-2 hover:bg-white/20 rounded-lg transition-colors"
								title="Fechar"
							>
								<X class="w-5 h-5" />
							</button>
						</div>
					</div>

					<!-- Conteúdo do Modal -->
					<div class="p-6 overflow-auto max-h-[calc(90vh-80px)]">
						{#if currentMedia.type === 'image'}
							<!-- Imagem em tamanho grande -->
							<div class="flex justify-center">
								<img
									src={currentMedia.src}
									alt={currentMedia.filename}
									class="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
								/>
							</div>
						{:else if currentMedia.type === 'pdf'}
							<!-- PDF com todas as páginas -->
							<div class="space-y-6">
								<h3 class="text-lg font-semibold text-gray-800 mb-4">Visualização do Documento</h3>
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									{#each currentMedia.links as link, linkIndex}
										{#if !(linkIndex % 2) && currentMedia.links[linkIndex + 1] !== 'pdf'}
											<div class="relative">
												<img
													src={link}
													alt="Página {Math.floor(linkIndex / 2) + 1}"
													class="w-full h-auto object-contain rounded-lg shadow-md border border-gray-200"
												/>
												<div
													class="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs"
												>
													Página {Math.floor(linkIndex / 2) + 1}
												</div>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Modais existentes -->
		{#if showLimitacoesModal}
			<div
				class="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4"
				on:click={toggleLimitacoesModal}
				data-testid="limitacoes-modal"
			>
				<div class="bg-white rounded-xl max-w-md w-full shadow-2xl" on:click|stopPropagation>
					<!-- Header do Modal -->
					<div class="flex items-center justify-between p-6 border-b border-gray-200">
						<h2 class="text-2xl font-bold text-gray-800">Limitações</h2>
						<button
							on:click={toggleLimitacoesModal}
							class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
							title="Fechar"
						>
							<X class="w-5 h-5 text-gray-600" />
						</button>
					</div>
					<!-- Conteúdo -->
					<div class="p-6">
						<ul class="list-disc list-inside text-gray-700 space-y-2">
							<li>Grupos não suportados</li>
							<li>Tamanho máximo dos arquivos: 40 Mb</li>
							<li>Não confere garantia de autenticidade</li>
						</ul>
					</div>
				</div>
			</div>
		{/if}

		{#if showLGPDModal}
			<div
				class="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4"
				on:click={toggleLGPDModal}
				data-testid="lgpd-modal"
			>
				<div class="bg-white rounded-xl max-w-md w-full shadow-2xl" on:click|stopPropagation>
					<!-- Header do Modal -->
					<div class="flex items-center justify-between p-6 border-b border-gray-200">
						<h2 class="text-2xl font-bold text-gray-800">LGPD</h2>
						<button
							on:click={toggleLGPDModal}
							class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
							title="Fechar"
						>
							<X class="w-5 h-5 text-gray-600" />
						</button>
					</div>
					<!-- Conteúdo -->
					<div class="p-6">
						<p class="text-gray-700">
							Não coletamos nenhum dado e todos os arquivos são destruídos após o uso.
						</p>
					</div>
				</div>
			</div>
		{/if}
	</div>
</main>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(-20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.animate-fade-in {
		animation: fade-in 0.8s ease-out;
	}

	.animate-slide-in {
		animation: slide-in 0.6s ease-out;
	}

	/* Scrollbar personalizado */
	.chat-container ::-webkit-scrollbar {
		width: 8px;
	}

	.chat-container ::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.05);
		border-radius: 10px;
	}

	.chat-container ::-webkit-scrollbar-thumb {
		background: linear-gradient(to bottom, #10b981, #14b8a6);
		border-radius: 10px;
	}

	.chat-container ::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(to bottom, #059669, #0d9488);
	}

	/* Melhor responsividade para mensagens */
	@media (max-width: 768px) {
		.message-wrapper .max-w-\[75\%\] {
			max-width: 85%;
		}

		/* Garantir que os modais sejam responsivos */
		.message-content {
			overflow-wrap: break-word;
			word-break: break-word;
		}
	}

	/* Ajustes específicos para responsividade */
	@media (max-width: 640px) {
		.message-wrapper .max-w-\[75\%\] {
			max-width: 90%;
		}

		.message-wrapper .sm\:max-w-\[85\%\] {
			max-width: 95%;
		}
	}
</style>
