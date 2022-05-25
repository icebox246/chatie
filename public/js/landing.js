const installContainer = document.querySelector("#install-container")
const installButton = document.querySelector("#install-button")

let deferedPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
	e.preventDefault();
	deferedPrompt = e;

	installContainer.classList.remove("hidden");

	installButton.addEventListener('click', () => {
		installContainer.classList.add("hidden");

		deferedPrompt.prompt();

		deferedPrompt.userChoice.then((choiceResult) => {
			if(choiceResult.outcome === 'accepted') {
				console.log("User accepted installing app.")
			} else {
				console.log("User denied installing app.")
			}
			deferedPrompt = null;
		})
	})
})
