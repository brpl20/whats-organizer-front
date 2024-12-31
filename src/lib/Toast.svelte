<script>
	import { onDestroy, onMount } from 'svelte';
	import CloseSvg from './CloseSvg.svelte';

	/**
	 * @typedef {object} ToastProps
	 * @property {() => SvelteComponent=} [svg]
	 * @property {string} text
	 * @property {string} toastId
	 * @property {() => void} [onDismiss]
	 * @property {boolean} dismiss
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
	 * @type {ToastProps['onDismiss']}
	 */
	export let onDismiss = () => undefined;

	export let dismiss = false;

	/** @type {true|''}*/
	let isVisible;


	$: if(dismiss) {
		onDismiss()
		isVisible = ''
	} else { 
		isVisible = true;
	}

</script>

<div class="toast-container">
	<div id={`toast-${toastId}`} class="toast {isVisible && 'visible'}" role="alert">
		<div class="icon-container">
			<svelte:component this={svg} />
			<span class="sr-only">Notificação</span>
		</div>
		<div class="toast-text">{text}</div>
		<button type="button" class="dismiss-button" on:click={onDismiss} aria-label="Close">
			<span class="sr-only">Close</span>
			<CloseSvg />
		</button>
	</div>
</div>

<style>
	.toast-container {
		position: fixed;
		z-index: 10;
		top: 2rem;
		left: 50%;
		transform: translate(-50%, 0);
		width: auto;
		height: auto;
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

	.toast-text {
		margin-left: 1.5rem;
		font-size: 0.875rem;
		font-weight: 400;
	}

	.dismiss-button {
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
		transition:
			background-color 200ms,
			color 200ms;
	}

	.dismiss-button:hover {
		background-color: #f3f4f6;
		color: #111827;
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
