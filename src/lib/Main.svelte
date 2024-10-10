<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import JSZip from 'jszip';
  import mammoth from 'mammoth';
  import { browser } from '$app/environment';
  import { io } from 'socket.io-client';
  import jsPDF from 'jspdf';
  import Pre from '$lib/Pre.svelte'

  let fileInput;
  let result = null;
  let isLoading = false;
  let error = null;
  let showLimitacoesModal = false;
  let showLGPDModal = false;
  let messages = [];
  let socketMessages = [];
  let showPDFButton = false;

  const socket = io('http://localhost:5000');

  socket.on('Smessage', (data) => {
    socketMessages = [...socketMessages, data.data];
  });

  function toggleLimitacoesModal() {
    showLimitacoesModal = !showLimitacoesModal;
  }

  function toggleLGPDModal() {
    showLGPDModal = !showLGPDModal;
  }

  async function processZipFile(file) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    for (let [filename, zipEntry] of Object.entries(contents.files)) {
      const arrayBuffer = await zipEntry.async('arraybuffer');
      const blob = new Blob([arrayBuffer], { type: getFileType(filename) });
      const url = URL.createObjectURL(blob);

      messages = await Promise.all(messages.map(async (msg) => {
        if (msg.FileAttached === filename) {
          const fileInfo = await getFileInfo(blob, filename);
          return { ...msg, FileURL: url, ...fileInfo };
        }
        return msg;
      }));
    }
  }

  function getFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'mp4': return 'video/mp4';
      case 'opus': return 'audio/opus';
      default: return 'application/octet-stream';
    }
  }

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
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const text = result.value;
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

  async function handleSubmit() {
    if (!fileInput.files[0]) {
      error = "Por favor selecione um arquivo zip antes.";
      return;
    }

    const file = fileInput.files[0];
    if (!file.name.endsWith('.zip')) {
      error = "Please select a ZIP file.";
      return;
    }

    error = null;
    isLoading = true;
    result = null;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      result = await response.json();
      if (Array.isArray(result) && result.length > 0 && result[0].ERRO) {
        error = result[0].ERRO;
      } else {
        messages = result;
        await processZipFile(file);
        showPDFButton = true; // Show the PDF button after processing
      }
    } catch (e) {
      console.error("Houve um erro ao processar o arquivo:", e);
      error = "Houve um erro ao processar o arquivo. Por favor tente .";
    } finally {
      isLoading = false;
    }
  }

  function generatePDF() {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [595, 842] // A4 Size
    });

    const chatContainer = document.querySelector('.chat-container');

    if (chatContainer) {
      doc.html(chatContainer, {
        callback: function (doc) {
          doc.save('chat.pdf');
        },
        x: 10,
        y: 10,
        html2canvas: {
          scale: 0.5 // scale
        }
      });
    } else {
      console.error('Chat container not found');
    }
  }

  function isAudioFile(filename) {
    return filename && filename.endsWith('.opus');
  }

  function isVideoFile(filename) {
    return filename && filename.endsWith('.mp4');
  }

  function getFileName(path) {
    return path.split('/').pop();
  }

  onMount(() => {
    if (browser) {
      // Any client-side initialization code can go here
    }
  });
</script>

<svelte:head>
  <title>WhatsOrganizer</title>
</svelte:head>

<main>
  <h1>WhatsOrganizer</h1>
  
  <p class="subtitle">
    Organize suas conversas de WhatsApp<br>
    e transcreva áudios de forma rápida e<br>
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
  {:else}
    <div class="file-zip">
      <input type="file" bind:this={fileInput} accept=".zip" />
      <button on:click={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Processando...' : 'Enviar'}
      </button>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}

  {#if messages.length > 0}
    <div class="chat-container">
      {#each messages as message}
        <div class="message-wrapper {message.ID === 1 ? 'left' : 'right'}">
          <div class="message-bubble">
            <div class="message-header">
              <span class="message-name">{message.Name}</span>
              <span class="message-time">{message.Time}</span>
            </div>
            {#if message.FileAttached !== false}
              {#if message.FileAttached }
                {#if message.links}
                  <div class="thumbnails">
                    <div class="filename">{getFileName(message.FileAttached)}</div>
                    {#each message.links as link, index}
                      {#if index % 2 === 0}
                        <div class="thumbnail-container">
                          <img 
                            src={link} 
                            alt="PDF as Image" 
                            class="thumbnail-pdf {message.links[index + 1] === 'landscape' ? 'landscape' : 'portrait'}" 
                          />
                        </div>
                      {/if}
                    {/each}
                    <span class="small-description">Imagens apenas ilustrativas, confira os arquivos originais, demonstrando no  6 miniaturas máximo.</span>
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
                  <video controls src={message.FileURL}></video>
                {/if}

                {#if message.FileAttached.toLowerCase().includes('.jpg') || 
                     message.FileAttached.toLowerCase().includes('.jpeg') || 
                     message.FileAttached.toLowerCase().includes('.png')}
                  <div class="filename">{getFileName(message.FileAttached)}</div>
                  <img src={message.FileURL} alt="Image file" class="image-preview" />
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
    Faça o upload do seu arquivo exportado do WhatsApp<br>
    ele estará no formato .zip, confira como fazer:
  </p>
  <div class="platform-icons">
    <a href="https://faq.whatsapp.com/1180414079177245/?cms_platform=iphone&helpref=platform_switcher" class="platform-icon">
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
    <button class="floating-button" on:click={generatePDF}>
      Download PDF
    </button>
  {/if}
  <Pre />
</main>

{#if showLimitacoesModal}
  <div class="modal-backdrop" on:click={toggleLimitacoesModal}>
    <div class="modal" transition:fade on:click|stopPropagation>
      <h2>Limitações</h2>
      <ul>
        <li>- Grupos não suportados</li>
        <li>- Tamanho máximo dos arquivos: 40 Mb</li>
        <li>- Não confere garantia de autenticidade</li>
      </ul>
      <button on:click={toggleLimitacoesModal}>Fechar</button>
    </div>
  </div>
{/if}

{#if showLGPDModal}
  <div class="modal-backdrop" on:click={toggleLGPDModal}>
    <div class="modal" transition:fade on:click|stopPropagation>
      <h2>LGPD</h2>
      <p>Não coletamos nenhum dado e todos os arquivos são totalmente destruídos após as etapas do organizador serem concluídas.</p>
      <button on:click={toggleLGPDModal}>Fechar</button>
    </div>
  </div>
{/if}

<style>
  *{
    font-family: Arial, sans-serif;
    list-style-type: none;
  }
.smessage-li{
  text-align:center;
}
.spinner-container{
  display: flex;
  align-items: center; 
  justify-content: center;
  gap: 10px;
  text-align:center;
}
.spinner{
  width: 50px;
  aspect-ratio: 1;
  display: grid;
  border: 4px solid #0000;
  border-radius: 50%;
  border-right-color: #005C4B;
  animation: l15 1s infinite linear;
}
.spinner::before,
.spinner::after {    
  content: "";
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
@keyframes l15{ 
  100%{transform: rotate(1turn)}
}



  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  main {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    text-align: center;
    background-color: #58F1C4;
    color: #1c1c1c;
    border-radius: 10px;
  }

  h1 {
    font-size: 3.0em;
    margin-bottom: 10px;
    font-family: 'Alfa Slab One', system-ui;
    font-weight:700;
    text-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
    color: #005C4B;
  }

  .subtitle, .instructions {
    margin-bottom: 20px;
    color: #005C4B;
  }

  input[type="file"] {
    flex-grow: 1;
    padding: 25px;
    border: none;
    border-radius: 5px;
    background-color: white;
    font-size:16px;
  }

  button {
    padding: 18px 30px;
    border: none;
    border-radius: 5px;
    background-color: #1c1c1c;
    color: white;
    cursor: pointer;
    font-size:15px;
  }

  .platform-icons {
    display: flex;
    justify-content:center;
    gap: 1rem;
    align-items: center;
    margin:15px;
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
    background-color: #145C4B;
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
    color:#1c1c1c;
  }

  .modal {
    background-color: white;
    padding: 20px;
    border-radius: 5px;
    max-width: 400px;
    text-align: left;
    border-top: 3px solid;
    border-image: linear-gradient(to right, #00F38D, #00B4F3) 1;
    font-size:18px;
  }

  .modal h2 {
    margin-top: 0;
  }

  .modal button {
    margin-top: 10px;
    border-radius: 5px;
    background-color:#00F38D;
    color:#1c1c1c;
    font-size: 15px;
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

  .message-bubble video {
    max-width: 100%;
    height: auto;
    display: block;
    overflow: hidden;
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
    font-size:17px;
  }
</style>