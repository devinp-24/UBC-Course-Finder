window.onload = function() {
	const datasetList = document.getElementById("datasetList");

	fetch(`http://localhost:4321/datasets`, { method: "GET" })
		.then(response => {
			if (!response.ok) {
				throw new Error('Network response was not ok: ' + response.statusText);
			}
			return response.json(); // Parse JSON response
		})
		.then(data => {
			if (data.result) {
				// Clear the list before displaying the updated datasets
				datasetList.innerHTML = "";

				// Append each dataset ID to the list
				data.result.forEach(dataset => {
					const listItem = document.createElement("li");
					listItem.textContent = `Dataset ID: ${dataset.id}`;
					datasetList.appendChild(listItem);
				});
			} else if (data.error) {
				const listItem = document.createElement("li");
				listItem.textContent = `Error fetching datasets: ${data.error}`;
				datasetList.appendChild(listItem);
			}
		})
		.catch(error => {
			console.error("Error fetching datasets:", error);
			const listItem = document.createElement("li");
			listItem.textContent = "Failed to load datasets. Please try again.";
			datasetList.appendChild(listItem);
		});
};
