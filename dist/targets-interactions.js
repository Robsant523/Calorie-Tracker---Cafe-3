document.querySelectorAll('input[name="targetMode"]').forEach(input=>input.addEventListener('change',()=>{state.targetMode=input.value;renderTargetForm()}));
