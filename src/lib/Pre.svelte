<script>
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { Youtube } from 'svelte-youtube-lite';
  </script>
  
  <div class="divPre">
    <Youtube id="X_JlLlebbx0" />

    <footer>
      2024 por <b> ProcStudio </b> e <b> <a href="https://www.youtube.com/@brunopellizzetti" target="_blank">Bruno Pellizzetti</a></b>
    </footer>
  
  </div>
  
  
  
    <style>
      h2 {
        font-size: 1.5em;
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
        .input-group {
      display: flex;
      margin-bottom: 20px;
      justify-content: center;
    }
      input[type="email"] {
        flex-grow: 1;
        padding: 10px;
        border: none;
        border-radius: 5px 0 0 5px;
        background-color: white;
        max-width: 300px;
      }
      button {
        padding: 10px 20px;
        border: none;
        border-radius: 0 5px 5px 0;
        background-color: #1c1c1c;
        color: white;
        cursor: pointer;
      }
      .error {
        color: red;
        margin-top: 10px;
      }
      .success {
        color: #005C4B;
        font-weight: bold;
        margin-top: 10px;
      }
    </style>
  