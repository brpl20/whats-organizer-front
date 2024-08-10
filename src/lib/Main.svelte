<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let fileInput;
  let result = null;
  let isLoading = false;
  let error = null;
  let zipFile;
  let showLimitacoesModal = false;
  let showLGPDModal = false;

  function toggleLimitacoesModal() {
    showLimitacoesModal = !showLimitacoesModal;
  }

  function toggleLGPDModal() {
    showLGPDModal = !showLGPDModal;
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
    } catch (e) {
      console.error("There was an error processing the file:", e);
      error = "There was an error processing the file. Please try again.";
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    // Any initialization code can go here
  });
  </script>
  
  <main>
    <h1>WhatsOrganizer</h1>
    
    <p class="subtitle">
      Organize suas conversas de WhatsApp<br>
      e transcreva áudios de forma rápida e<br>
      segura de uma única vez
    </p>
    
    <div>
        <input type="file" bind:this={fileInput} accept=".zip" />
        <button on:click={handleSubmit} disabled={isLoading}>
        {isLoading ? 'Processing...' : 'Send'}
        </button>
    </div>
    
    {#if error}
        <p class="error">{error}</p>
    {/if}

    {#if result}
        <h2>Result:</h2>
        <pre>{JSON.stringify(result, null, 2)}</pre>
    {/if}


    <p class="instructions">
      Faça o upload do seu arquivo exportado do WhatsApp<br>
      ele estará no formato .zip, confira como fazer:
    </p>
  
    <div class="icons">
      <span class="icon">🍎</span>
      <span class="icon">🤖</span>
    </div>
  
    <div class="buttons">
      <button class="secondary" on:click={toggleLimitacoesModal}>Limitações</button>
      <button class="secondary" on:click={toggleLGPDModal}>LGPD</button>
    </div>
  
    <footer>
      2024 por ProcStudio e Bruno Pellizzetti
    </footer>
  </main>
  
  {#if showLimitacoesModal}
    <div class="modal-backdrop" on:click={toggleLimitacoesModal}>
      <div class="modal" transition:fade on:click|stopPropagation>
        <h2>Limitações</h2>
        <ul>
          <li>Grupos não suportados</li>
          <li>Tamanho máximo dos arquivos: 40 Mb</li>
          <li>Não confere garantia de autenticidade</li>
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
    main {
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      text-align: center;
      background-color: #58F1C4;
      color: #1c1c1c;
      border-radius: 10px;
    }
  
    h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      font-family: 'Alfa Slab One', system-ui;
      text-shadow: 0 4px 4px rgba(0, 0, 0, 0.25);
      color: #005C4B;
    }
  
    .subtitle, .instructions {
      margin-bottom: 20px;
      color: #019D80
    }
  
    .input-group {
      display: flex;
      margin-bottom: 20px;
    }
  
    input[type="file"] {
      flex-grow: 1;
      padding: 10px;
      border: none;
      border-radius: 5px 0 0 5px;
      background-color: white;
    }
  
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 0 5px 5px 0;
      background-color: #1c1c1c;
      color: white;
      cursor: pointer;
    }
  
    .icons {
      font-size: 2em;
      margin-bottom: 20px;
    }
  
    .icon {
      margin: 0 10px;
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

  
    .secondary {
      background-color: transparent;
      border: 2px solid #1c1c1c;
      color: #1c1c1c;
      border-radius: 5px;
    }
  
    footer {
      font-size: 0.8em;
      margin-top: 20px;
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
    }
  
    .modal {
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      max-width: 400px;
      text-align: left;
    }
  
    .modal h2 {
      margin-top: 0;
    }
  
    .modal button {
      margin-top: 10px;
      background-color: #00ffa6;
      color: #1c1c1c;
      border-radius: 5px;
    }
  
    .modal ul {
      padding-left: 20px;
    }
  </style>