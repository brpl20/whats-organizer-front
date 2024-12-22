<script>
	import UploadIcon from "./UploadIcon.svelte";

    /** @type {File[]} */
    let files = [];
    /** @type {HTMLInputElement | null} */
    let fileInput = null;
    let isDragging = false;

    let svgY = 45
    $: files?.length && (svgY += files.length * 15);

    function handleDrop(event) {
        event.preventDefault();
        const droppedFiles = event.dataTransfer?.files;
        if (droppedFiles?.length > 0) {
            files = Array.from(droppedFiles);
        }
        isDragging = false;
    }

    function handleDragOver(event) {
        event.preventDefault();
        isDragging = true;
    }

    function handleDragLeave() {
        isDragging = false;
    }

    function triggerFileInput() {
        fileInput?.click();
    }
</script>

<style>
    .upload-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        font-family: Arial, sans-serif;
        margin-bottom: 20px;
    }

    .drop-area {
        position: relative;
        border-radius: 10px;
        padding: 30px;
        text-align: center;
        color: #005c4b;
        cursor: pointer;
        width: 100%;
        max-width: 400px;
        border: .2px solid #bbb;
        transition: border-color 0.3s ease, box-shadow 0.3s ease;
        overflow: hidden;
        background-color: #f0f8ff;
    }

    .drop-area>span {
        color: #001cdd;
    }

    .drop-area:is(.dragging,:hover) {
        box-shadow: 0 0 5px #aaa;
        border-style: inset;
        border-width: .5px;
    }

    .box-animation {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
    }

    .box-animation line {
        stroke: #007bff;
        stroke-width: 0.8px;
        fill: none;
        stroke-dasharray: 400;
        stroke-dashoffset: 400;
        transition: stroke-dashoffset 1.4s linear;
    }

    .drop-area:is(.dragging, :hover) line {
        stroke-dashoffset: 0;
    }


    .file-list {
        margin-top: 20px;
        text-align: left;
        max-width: 400px;
        width: 100%;
    }

    .file-list ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .file-list li {
        background-color: #fff;
        margin-bottom: 5px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 0.9rem;
        animation: slide-in 0.5s ease;
    }

    .hidden {
        display: none;
    }

    .underline {
        text-decoration-line: underline;
    }

    @keyframes slide-in {
        0% {
            transform: scale(0.5);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }
</style>

<div class="upload-container">
    <button
        class="drop-area {isDragging ? 'dragging' : ''}"
        on:dragover|preventDefault={handleDragOver}
        on:dragleave={handleDragLeave}
        on:drop|preventDefault={handleDrop}
        aria-label="Drop files here or click to upload"
        tabindex="0"
        on:click={triggerFileInput}
        type="button"
    >
    <div>
        <UploadIcon />
    </div>
        Arraste seu Arquivo
        <br />
        Ou
        <br />
        <span class="underline">Clique para fazer Upload</span>
        <svg class="box-animation" viewBox={`0 0 100 ${svgY}`} preserveAspectRatio="none">
            <line  x1="0" y1="0" x2="100" y2="0" />
            <line  x1="100" y1="0" x2="100" y2={`${svgY}`} />
            <line  x1="100" y1={`${svgY}`} x2="0" y2={`${svgY}`} />
            <line  x1="0" y1={`${svgY}`} x2="0" y2="0" />
        </svg>
        
        {#if files.length > 0}
        <div class="file-list">
            <h4>Arquivos:</h4>
            <ul>
                {#each files as file}
                    <li>{file.name}</li>
                {/each}
            </ul>
        </div>
        {/if}
    </button>
    <div class="hidden">
        <input class="file-input" type="file" bind:this={fileInput} accept=".zip" on:change={(e) => files = fileInput?.files || files} />
    </div>
</div>
