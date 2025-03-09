<script>
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import UploadIcon from './UploadIcon.svelte';

	export let loading = false;

	/** @type {FileList} */
	let files = [];
	/** @type {HTMLInputElement | null} */
	let fileInput = null;
	let isDragging = false;

	let svgY = 45;
	$: files?.length && (svgY += files.length * 15);
	const dispatch = createEventDispatcher();
	$: dispatch('update', files);

	const handleDrop = (event) => {
		event.preventDefault();
		const droppedFiles = event.dataTransfer?.files;
		if (droppedFiles?.length > 0) {
			const dataTransfer = new DataTransfer();
			Array.from(droppedFiles).forEach(file => dataTransfer.items.add(file));
			fileInput.files = dataTransfer.files;

			files = Array.from(droppedFiles);
		}
		isDragging = false;
	}

	const handleDragOver = (event) => {
		event.preventDefault();
		isDragging = true;
	}

	const handleDragLeave = () => {
		isDragging = false;
	}

	const triggerFileInput = () => {
		fileInput?.click();
	}
</script>

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
		<div class="fade-container">
			{#if loading}
				<div class="spinner-container" transition:fade>
					<div class="spinner" aria-label="Carregando"></div>
				</div>
			{:else}
				<div class="icon-container" transition:fade>
					<UploadIcon />
				</div>
			{/if}
		</div>
		Arraste seu Arquivo
		<br />
		Ou
		<br />
		<span class="underline">Clique para fazer Upload</span>
		<svg class="box-animation" viewBox={`0 0 100 ${svgY}`} preserveAspectRatio="none">
			<line x1="0" y1="0" x2="100" y2="0" />
			<line x1="100" y1="0" x2="100" y2={`${svgY}`} />
			<line x1="100" y1={`${svgY}`} x2="0" y2={`${svgY}`} />
			<line x1="0" y1={`${svgY}`} x2="0" y2="0" />
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
		<input
			class="file-input"
			type="file"
			bind:this={fileInput}
			accept=".zip"
			on:change={(e) => (files = fileInput?.files || files)}
		/>
	</div>
</div>

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
        display: flex;
        align-items: center;
        flex-direction: column;
		border-radius: 10px;
		padding: 30px;
		text-align: center;
		color: #005c4b;
		cursor: pointer;
		width: 100%;
		max-width: 400px;
		border: 0.2px solid #bbb;
		transition:
			border-color 0.3s ease,
			box-shadow 0.3s ease;
		overflow: hidden;
		background-color: #f0f8ff;
	}

	.drop-area > span {
		color: #001cdd;
	}

	.drop-area:is(.dragging, :hover) {
		box-shadow: 0 0 5px #aaa;
		border-style: inset;
		border-width: 0.5px;
	}

	@media (hover: none) {
		.drop-area:is(.dragging, :active, :focus) {
			box-shadow: 0 0 5px #aaa;
			border-style: inset;
			border-width: 0.5px;
		}

		.drop-area:is(.dragging, :active, :focus) line {
			stroke-dashoffset: 0;
		}
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

    .file-list h4 {
        padding-left: 9px;
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

	.spinner {
		height: 90px !important;
		width: 90px !important;
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

	.fade-container {
		position: relative;
		width: 96px;
		height: 96px;
        margin-top: -5px;
        margin-bottom: 5px;
	}

	.spinner-container,
	.icon-container {
		position: absolute;
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
