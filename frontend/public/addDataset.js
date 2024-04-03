document.getElementById("datasetForm").addEventListener("submit", function (event) {
	event.preventDefault(); // Prevent the default form submission

	const datasetId = document.getElementById("datasetId").value;
	const datasetFileInput = document.getElementById("datasetFile");
	const file = datasetFileInput.files[0];
	const feedbackMessage = document.getElementById("feedbackMessage");

	if (!file) {
		feedbackMessage.textContent = "Please select a dataset file to upload.";
		return;
	}

	const formData = new FormData();
	formData.append('dataset', file, file.name); // Append the file to formData

	fetch(`http://localhost:4321/dataset/${datasetId}/sections`, {
		method: "PUT",
		body: file
	})
		.then(response => {
			if (!response.ok) {
				throw new Error('Network response was not ok: ' + response.statusText);
			}
			return response.json(); // Parse JSON response
		})
		.then(data => {
			if (data.result) {
				feedbackMessage.textContent = "Dataset added successfully!";
				alert("Success"); // Now this should work
			} else if (data.error) {
				feedbackMessage.textContent = `Error adding dataset: ${data.error}`;
				alert("Error adding dataset: " + data.error);
			}
		})
		.catch(error => {
			console.error("Error adding dataset:", error);
			feedbackMessage.textContent = "Failed to add the dataset. Please try again.";
			alert("Error caught: " + error.message); // Now alert the actual error message
		});
});
