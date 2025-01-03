<script>
	import { onDestroy } from 'svelte';
	import CloseSvg from './CloseSvg.svelte';

	/**
	 * @typedef {import('./types/toast.type.js').ToastProps} ToastProps
	 */

	/**
	 * @type {ToastProps['svg']}
	 */
	export let svg = null;

	/**
	 * @type {ToastProps['text']}
	 */
	export let text = '';

	/**
	 * @type {ToastProps['onClose']}
	 */
	export let onClose = () => undefined;

		/**
	 * @type {ToastProps['closed']}
	 */
	export let closed = false;

	/**
	 * @type {ToastProps['error']}
	 */
	export let error = false;

	/**
	 * Se dispensado no CSS (Geralmente dispensado uns millisegundos
	 * antes de removed, para mostrar a animação de fade sumindo
	 */
	let internallyDismissed = false;

	/**
	 * Elemento removido do HTML (Após a animação CSS)
	 */
	let removed = false;

	$: if (removed) onClose?.();

	const clearInternalTimeout = () => typeof timeout === 'number' && clearTimeout(timeout);

	const requestAnimatedDismiss = () => {
		internallyDismissed = true;
		clearInternalTimeout();
		timeout = setTimeout(() => (removed = true), 300);
	};

	/** insere no DOM com opacity 0 e inicia transition opacity 100% */
	const requestAnimatedPopup = () => {
		if (!text) return;

		removed = false;
		internallyDismissed = true;

		clearInternalTimeout();
		timeout = setTimeout(() => (internallyDismissed = false), 300);
	}; 

	let prevText = '';

	/*
	 * Inicia a animação de entrada da toast caso o texto tenha mudado
	 * mas a toast tenha sido dispensada internamente com o botão de
	 * fechar, dessa forma, a toast nova com texto novo deve aparecer
	 */
	const showNewToast = () => {
		const previouslyInternallyDismissed = removed && !closed;
		if (!previouslyInternallyDismissed) return;

		requestAnimatedPopup();
	}

	$: if (prevText !== text) {
		prevText = text;
		showNewToast();
	}

	/** Inicia/ finaliza a animação caso requisitado pelo componente pai */
	$: if (closed) requestAnimatedDismiss();
	$: if (!closed) requestAnimatedPopup();

	onDestroy(clearInternalTimeout);

	/** @type {NodeJS.Timeout}*/
	let timeout = null;

	const onDismiss = () => {
		requestAnimatedDismiss();
	};
</script>

{#if !removed}
	<div class="toast-container">
		<div
			class="toast
					{closed || internallyDismissed ? '' : 'visible'}
					{error ? 'error' : ''}
			"
			role="alert"
		>
			<div class="icon-container">
				<svelte:component this={svg} />
				<span class="sr-only">{error ? 'Erro' : 'Notificação'}</span>
			</div>
			<div class="toast-text">{error ? (text || "Erro Desconhecido!") : (text || "")}</div>
			<button type="button" class="close-button" on:click={onDismiss} aria-label="Close">
				<span class="sr-only">Close</span>
				<CloseSvg />
			</button>
		</div>
	</div>
{/if}

<style>
	.toast-container {
		position: fixed;
		z-index: 10;
		left: 50%;
		transform: translate(-50%, 0);
		width: auto;
		height: auto;
		backface-visibility: hidden;
		margin-top: 1rem;
	}

	.toast {
		display: flex;
		align-items: center;
		width: 18rem;
		height: 4rem;
		padding: 1rem;
		background-color: #e0f2fe;
		color: #374151;
		border-radius: 0.5rem;
		box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
		border: 1px solid #94a3b8;
		opacity: 0;
		transition: opacity 300ms;
	}

	.toast.error {
		color: #5f0616;
		border: 1px solid #f897a9;
		background-color: #ffe9e4;
	}

	.toast.visible {
		opacity: 1;
	}

	.icon-container {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
		background-color: #bfdbfe;
		color: #3b82f6;
		border-radius: 0.5rem;
	}

	.error .icon-container {
		background-color: #ffcdc1;
		color: #3b82f6;
	}

	.toast-text {
		margin-left: 1.5rem;
		font-size: 0.875rem;
		font-weight: 400;
	}

	.close-button {
		margin-left: auto;
		margin-right: -0.375rem;
		margin-top: -0.375rem;
		background-color: #ffffff;
		color: #9ca3af;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		padding: 0.375rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2rem;
		width: 2rem;
		cursor: pointer;
		transition-property: color background-color;
		transition-duration: 0.2s;
		transition-timing-function: linear;
	}

	.close-button:hover {
		background-color: #f3f4f6;
		color: #111827;
	}

	.error .close-button:hover {
		background-color: #fffaf9;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
