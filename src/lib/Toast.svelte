<script>
	import CloseSvg from './CloseSvg.svelte';

	/**
	 * @typedef {object} ToastProps
	 * @property {() => SvelteComponent=} [svg]
	 * @property {string} text
	 * @property {string} toastId
	 * @property {() => void} [onClose]
	 * @property {boolean} closed
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
	 * @type {ToastProps['toastId']}
	 */
	export let toastId = '';

	/**
	 * @type {ToastProps['onClose']}
	 */
	export let onClose = () => undefined;

	export let closed = false;

	export let error = false;

	export let internallyDismissed = false;

	export let removed = false;

	const requestAnimatedDismiss = () => timeout = setTimeout(() => (removed = true), 300);

	let prevText = ''

	$: if (prevText !== text) {
	    prevText = text;
    	if (removed) {
    	    removed = false;
    	    internallyDismissed = true;
    	    setTimeout(() => internallyDismissed = false, 300);
    	}
	}

	$: if (closed) requestAnimatedDismiss();

	/** @type {NodeJS.Timeout}*/
	let timeout = null;

	const onDismiss = () => {
		internallyDismissed = true;
		requestAnimatedDismiss();
		onClose();
	};
</script>

{#if !removed}
	<div class="toast-container">
		<div
			id={`toast-${toastId}`}
			class="toast
					{!(closed || internallyDismissed) ? 'visible' : ''}
					{error ? 'error' : ''}
			"
			role="alert"
		>
			<div class="icon-container">
				<svelte:component this={svg} />
				<span class="sr-only">{error ? 'Erro' : 'Notificação'}</span>
			</div>
			<div class="toast-text">{text}</div>
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
		contain: layout;
		isolation: isolate;
		will-change: transform;
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
