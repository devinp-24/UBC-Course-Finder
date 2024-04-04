// Function to create the bar graph with dynamic data
function createBarGraph(selectedDatasetId) {
	const insightsContainer = d3.select("#insights");
	const margin = { top: 30, right: 30, bottom: 70, left: 60 },
		width = 420 - margin.left - margin.right,
		height = 400 - margin.top - margin.bottom;

	// Define the query with the selected dataset ID
	const query = {
		"WHERE": {
			"GT": {
				[`${selectedDatasetId}_avg`]: 97
			}
		},
		"OPTIONS": {
			"COLUMNS": [
				`${selectedDatasetId}_dept`,
				"avgMarks"
			]
		},
		"TRANSFORMATIONS": {
			"GROUP": [`${selectedDatasetId}_dept`],
			"APPLY": [{
				"avgMarks": {
					"AVG": `${selectedDatasetId}_avg`
				}
			}]
		}
	};

	// Fetch the query results and display them
	fetch(`http://localhost:4321/query`, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(query)
	})
		.then(response => response.json())
		.then(data => {
			if (data.result) {
				// Clear any existing content
				insightsContainer.selectAll("*").remove();

				// Append the svg object to the insights container div
				const svg = insightsContainer.append("svg")
					.attr("width", width + margin.left + margin.right)
					.attr("height", height + margin.top + margin.bottom)
					.append("g")
					.attr("transform", `translate(${margin.left},${margin.top})`);

				// X axis
				const x = d3.scaleBand()
					.range([0, width])
					.domain(data.result.map(d => d[`${selectedDatasetId}_dept`]))
					.padding(0.2);

				// Add Y axis
				const y = d3.scaleLinear()
					.domain([0, d3.max(data.result, d => d.avgMarks)])
					.range([height, 0]);

				svg.append("text")
					.attr("transform", `translate(${(width / 2)}, ${height + margin.bottom / 2})`)
					.style("text-anchor", "middle")
					.style("font-size", "16px") // Make the font larger
					.text("Department");

				svg.append("g")
					.attr("transform", `translate(0, ${height})`)
					.call(d3.axisBottom(x))
					.append("text") // X axis label
					.attr("class", "axis-label")
					.attr("y", margin.bottom - 10)
					.attr("x", width / 2)
					.attr("text-anchor", "middle")
					.text("Department");

				svg.append("g")
					.call(d3.axisLeft(y))
					.append("text") // Y axis label
					.attr("class", "axis-label")
					.attr("transform", "rotate(-90)")
					.attr("y", 15 - margin.left) // Adjust the position of the Y axis label
					.attr("x", 0 - (height / 2))
					.attr("dy", "1em")
					.attr("text-anchor", "middle")
					.text("Average Marks");

				// Add Y axis label
				svg.append("text")
					.attr("transform", "rotate(-90)")
					.attr("y", 0 - margin.left)
					.attr("x",0 - (height / 2))
					.attr("dy", "1em") // Adjust position
					.style("text-anchor", "middle")
					.style("font-size", "16px") // Make the font larger
					.text("Average Marks");

				// Draw the bars
				svg.selectAll("rect")
					.data(data.result)
					.enter()
					.append("rect")
					.attr("x", d => x(d[`${selectedDatasetId}_dept`]))
					.attr("y", d => y(d.avgMarks))
					.attr("width", x.bandwidth())
					.attr("height", d => height - y(d.avgMarks))
					.attr("fill", "#3037b7");
			} else {
				insightsContainer.text("Failed to load insights.");
			}
		})
		.catch(error => {
			insightsContainer.text("Failed to load insights: " + error);
		});
}
function createPieChart(selectedDatasetId) {
	const insightsContainer = d3.select("#insights");
	const width = 500;
	const height = 450;
	const margin = 40;

	// Define the query with the selected dataset ID
	const query = {
		"WHERE": {
			"AND": [{
				"IS": {
					[`${selectedDatasetId}_dept`]: "cpsc"
				}
			}, {
				"IS": {
					[`${selectedDatasetId}_id`]: "3*"
				}
			}]
		},
		"OPTIONS": {
			"COLUMNS": [
				`${selectedDatasetId}_id`,
				"FAILED"
			]
		},
		"TRANSFORMATIONS": {
			"GROUP": [`${selectedDatasetId}_id`],
			"APPLY": [{
				"FAILED": {
					"COUNT": `${selectedDatasetId}_fail`
				}
			}]
		}
	};

	// Fetch the query results and display them
	fetch(`http://localhost:4321/query`, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(query)
	})
		.then(response => response.json())
		.then(data => {
			if (data.result) {
				// Clear any existing content
				insightsContainer.selectAll("*").remove();

				// Set up the SVG with proper transformations
				const svg = insightsContainer.append("svg")
					.attr("width", width)
					.attr("height", height)
					.append("g")
					.attr("transform", `translate(${width / 2}, ${height / 2})`);

				// Create a color scale
				const color = d3.scaleOrdinal(d3.schemeCategory10);

				// Compute the position of each group on the pie
				const pie = d3.pie()
					.value(d => d.FAILED);

				// Build the pie chart
				const path = d3.arc()
					.outerRadius(width / 2.5 - margin)
					.innerRadius(0);

				// Build the slices
				const arcs = svg.selectAll("arc")
					.data(pie(data.result))
					.enter()
					.append("g");

				arcs.append("path")
					.attr("d", path)
					.attr("fill", (d, i) => color(i));

				// Optional: Add labels to the slices
				const label = d3.arc()
					.outerRadius(width / 3)
					.innerRadius(width / 3 - 80);

				arcs.append("text")
					.attr("transform", d => `translate(${label.centroid(d)})`)
					.style("font-weight", "bold") // Make the font bolder
					.attr("dy", "0.25em")
					.style("text-anchor", "middle")
					.text(d => d.data[`${selectedDatasetId}_id`]);
				const legend = insightsContainer.select("svg")
					.append("g")
					.attr("class", "legend")
					.attr("transform", "translate(" + (width / 2 + 175) + "," + (-height / 2 + 300) + ")")
					.selectAll("g")
					.data(pie(data.result))
					.enter().append("g")
					.attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

				// Draw legend colored rectangles
				legend.append("rect")

					.attr("width", 18)
					.attr("height", 18)
					.attr("fill", (d, i) => color(i));

				// Draw legend text
				legend.append("text")
					.attr("x", 24)
					.attr("y", 9)
					.attr("dy", ".35em")
					.text(function(d) { return `${d.data[`${selectedDatasetId}_id`]}: ${d.data.FAILED}`; })
					.style("font-size", "12px")
					.style("font-weight", "bold");


			} else {
				insightsContainer.text("Failed to load insights.");
			}
		})
		.catch(error => {
			insightsContainer.text("Failed to load insights: " + error);
		});
}

function createScatterPlot(selectedDatasetId) {
	const insightsContainer = d3.select("#insights");
	const margin = { top: 40, right: 20, bottom: 30, left: 50 };
	const width = 600 - margin.left - margin.right;
	const height = 400 - margin.top - margin.bottom;

	// Define the query with the selected dataset ID
	const query = {
		"WHERE": {
			"IS": {
				[`${selectedDatasetId}_dept`]: "cpsc"
			}
		},
		"OPTIONS": {
			"COLUMNS": [
				`${selectedDatasetId}_instructor`,
				"avgMarks",
				"Passed"
			]
		},
		"TRANSFORMATIONS": {
			"GROUP": [`${selectedDatasetId}_instructor`],
			"APPLY": [
				{
					"avgMarks": {
						"AVG": `${selectedDatasetId}_avg`
					}
				},
				{
					"Passed": {
						"AVG": `${selectedDatasetId}_pass`
					}
				}
			]
		}
	};

	// Fetch the query results and display them
	fetch(`http://localhost:4321/query`, {
		method: "POST",
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(query)
	})
		.then(response => response.json())
		.then(data => {
			if (data.result) {
				// Clear any existing content
				insightsContainer.selectAll("*").remove();

				// Append the svg object to the insights container div
				const svg = insightsContainer.append("svg")
					.attr("width", width + margin.left + margin.right)
					.attr("height", height + margin.top + margin.bottom)
					.append("g")
					.attr("transform", `translate(${margin.left},${margin.top})`);

				// Create the scales for the axes
				const xScale = d3.scaleLinear()
					.domain(d3.extent(data.result, d => d.avgMarks))
					.range([0, width]);

				const yScale = d3.scaleLinear()
					.domain(d3.extent(data.result, d => d.Passed))
					.range([height, 0]);

				// Add the X Axis
				svg.append("g")
					.attr("transform", `translate(0,${height})`)
					.call(d3.axisBottom(xScale));

				// Add the Y Axis
				svg.append("g")
					.call(d3.axisLeft(yScale));

				// Add X axis label
				svg.append("text")
					.attr("x", width / 2)
					.attr("y", height + margin.bottom)
					.style("text-anchor", "middle")
					.text("Average Marks");

				// Add Y axis label
				svg.append("text")
					.attr("transform", "rotate(-90)")
					.attr("y", 0 - margin.left)
					.attr("x", 0 - height / 2)
					.attr("dy", "1em")
					.style("text-anchor", "middle")
					.text("Average Passed");

				// Add the scatterplot points
				svg.selectAll("dot")
					.data(data.result)
					.enter().append("circle")
					.attr("r", 5)  // Size of the dots
					.attr("cx", d => xScale(d.avgMarks))
					.attr("cy", d => yScale(d.Passed))
					.style("fill", "#69b3a2");

				// Add instructor names to the dots
				svg.selectAll("text")
					.data(data.result)
					.enter().append("text")
					.attr("x", d => xScale(d.avgMarks))
					.attr("y", d => yScale(d.Passed))
					.attr("dx", ".71em")  // Offsets to position the text
					.attr("dy", ".35em")
					.text(d => d[`${selectedDatasetId}_instructor`]);
			} else {
				insightsContainer.text("Failed to load insights.");
			}
		})
		.catch(error => {
			insightsContainer.text("Failed to load insights: " + error);
		});
}

// When the page is loaded, we fetch the list of datasets and populate the selector
function initializePage() {
	const datasetSelector = document.getElementById("datasetSelector");

	// Fetch datasets and populate the dataset selector dropdown
	fetch(`http://localhost:4321/datasets`, { method: "GET" })
		.then(response => response.json())
		.then(data => {
			if (data.result) {
				// Clear the selector
				datasetSelector.innerHTML = "";
				// Populate the selector with dataset IDs
				data.result.forEach(dataset => {
					const option = document.createElement("option");
					option.value = dataset.id;
					option.textContent = dataset.id;
					datasetSelector.appendChild(option);
				});
			} else {
				datasetSelector.innerHTML = "<option>Error loading datasets</option>";
			}
		})
		.catch(error => {
			console.error("Error loading datasets:", error);
			datasetSelector.innerHTML = "<option>Error loading datasets</option>";
		});

	// Populate the insights type dropdown
	const insightTypeSelector = document.getElementById("insightTypeSelector");
	const insights = ["Bar Chart - Department Average (view averages by department for section average > 97)",
		"Pie Chart - CPSC 300 Level Course Failures (Distribution of student failures across CPSC 300 level courses)",
		"Scatter Plot - Professor Performance in CPSC (Correlation between average marks and pass rates for all CPSC professors)."];
	insights.forEach(insight => {
		let option = document.createElement("option");
		option.value = insight;
		option.text = insight;
		insightTypeSelector.appendChild(option);
	});
}

// Event listener for the 'Load Insights' button
document.getElementById("loadInsights").addEventListener("click", function() {
	const selectedDatasetId = document.getElementById("datasetSelector").value;
	const selectedInsightType = document.getElementById("insightTypeSelector").value;
	const insightsContainer = d3.select("#insights");

	insightsContainer.selectAll("*").remove(); // Clear the previous insights

	if (!selectedDatasetId) {
		document.getElementById("insights").textContent = "Please select a dataset to view insights.";
		return;
	}

	switch (selectedInsightType) {
		case "Bar Chart - Department Average (view averages by department for section average > 97)":
			createBarGraph(selectedDatasetId);
			break;
		case "Pie Chart - CPSC 300 Level Course Failures (Distribution of student failures across CPSC 300 level courses)":
			createPieChart(selectedDatasetId);
			break;
		case "Scatter Plot - Professor Performance in CPSC (Correlation between average marks and pass rates for all CPSC professors).":
			createScatterPlot(selectedDatasetId)
			break;
		default:
			document.getElementById("insights").textContent = "Please select an insight type.";
	}
});

// Initialize the page when the window loads
window.addEventListener('load', initializePage);

