document.getElementById("removeDatasetForm").addEventListener("submit", function (event) {
	event.preventDefault(); // Prevent the default form submission

	const datasetId = document.getElementById("removeDatasetId").value;
	const feedbackMessage = document.getElementById("removeFeedbackMessage");

	if (!datasetId) {
		feedbackMessage.textContent = "Please enter a dataset ID to remove.";
		return;
	}
	alert(datasetId);
	fetch(`http://localhost:4321/dataset/${datasetId}`, {
		method: "DELETE",
	})
		.then(response => {
			if (!response.ok) {
				throw new Error('Network response was not ok: ' + response.statusText);
			}
			return response.json(); // Parse JSON response
		})
		.then(data => {
			if (data.result) {
				feedbackMessage.textContent = "Dataset removed successfully!";
				// Optionally, update the UI to reflect the dataset has been removed
			} else if (data.error) {
				feedbackMessage.textContent = `Error removing dataset: ${data.error}`;
			}
		})
		.catch(error => {
			console.error("Error removing dataset:", error);
			feedbackMessage.textContent = "Failed to remove the dataset. Please try again.";
		});
});
