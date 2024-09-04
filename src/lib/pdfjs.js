import { browser } from '$app/environment';

let pdfjsLib;

if (browser) {
  import('pdfjs-dist').then(module => {
    pdfjsLib = module;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  });
}

export { pdfjsLib };