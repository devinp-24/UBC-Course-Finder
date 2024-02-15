import {Query, Filter, LogicComparison, MComparison, SComparison, Options, Negation} from "../dataModels/Query";
import CourseData from "../dataModels/CourseData";
import Section from "../dataModels/Section";
import {ResultTooLargeError} from "../controller/IInsightFacade";

export class Executor {
	public extractDatasetId(query: Query): string {
		// Initialize an empty set to collect unique dataset IDs
		let datasetIds = new Set<string>();

		// Extract dataset IDs from the WHERE clause
		this.extractIdsFromFilter(query.WHERE, datasetIds);

		// Extract dataset IDs from the OPTIONS clause
		query.OPTIONS.COLUMNS.forEach((column) => {
			const datasetId = this.extractIdFromKey(column);
			if (datasetId) {
				datasetIds.add(datasetId);
			}
		});

		// Assuming consistency, there should only be one dataset ID
		if (datasetIds.size !== 1) {
			throw new Error("Query must use a single dataset ID");
		}

		return datasetIds.values().next().value;
	}

	private extractIdsFromFilter(filter: Filter, datasetIds: Set<string>): void {
		if (Object.keys(filter).length === 0) {
			// Base case: empty filter
			return;
		}

		Object.entries(filter).forEach(([key, value]) => {
			if (key === "AND" || key === "OR") {
				(value as Filter[]).forEach((subFilter) => this.extractIdsFromFilter(subFilter, datasetIds));
			} else if (key === "NOT") {
				this.extractIdsFromFilter(value as Filter, datasetIds);
			} else {
				// MComparison, SComparison
				const fieldKey = Object.keys(value)[0];
				const datasetId = this.extractIdFromKey(fieldKey);
				if (datasetId) {
					datasetIds.add(datasetId);
				}
			}
		});
	}

	private extractIdFromKey(key: string): string | null {
		const underscoreIndex = key.indexOf("_");
		if (underscoreIndex !== -1) {
			return key.substring(0, underscoreIndex);
		}
		return null;
	}

	public applyFilters(courseData: CourseData, filter: Filter): Section[] {
		if (Object.keys(filter).length === 0) {
			// If the filter is empty, return all sections
			return courseData.sections;
		}

		return courseData.sections.filter((section) => {
			return this.evaluateFilter(section, filter);
		});
	}

	private isLogicComparison(filter: Filter): filter is LogicComparison {
		return "AND" in filter || "OR" in filter;
	}

	private isMComparison(filter: Filter): filter is MComparison {
		return "LT" in filter || "GT" in filter || "EQ" in filter;
	}

	private isSComparison(filter: Filter): filter is SComparison {
		return "IS" in filter;
	}

	private isNegation(filter: Filter): filter is Negation {
		return "NOT" in filter;
	}

	private evaluateFilter(section: Section, filter: Filter): boolean {
		if (this.isLogicComparison(filter)) {
			if (filter.AND) {
				return filter.AND.every((subFilter) => this.evaluateFilter(section, subFilter));
			} else if (filter.OR) {
				return filter.OR.some((subFilter) => this.evaluateFilter(section, subFilter));
			} else {
				return false;
			}
		} else if (this.isNegation(filter)) {
			return !this.evaluateFilter(section, filter.NOT);
		} else if (this.isSComparison(filter)) {
			const [key, comparisonValue] = Object.entries(filter.IS)[0];
			const keyParts = key.split("_");
			const value = filter.IS[key];
			const getValue = section.get(keyParts[1]) as string;
			// Assuming wildcards are not to be implemented in this example
			if (comparisonValue.startsWith("*") && comparisonValue.endsWith("*")) {
				const trimmedValue = comparisonValue.slice(1, -1);
				return getValue.includes(trimmedValue);
			} else if (comparisonValue.startsWith("*")) {
				const trimmedValue = comparisonValue.slice(1);
				return getValue.endsWith(trimmedValue);
			} else if (comparisonValue.endsWith("*")) {
				const trimmedValue = comparisonValue.slice(0, -1);
				return getValue.startsWith(trimmedValue);
			} else {
				return getValue === value;
			}
		} else if (this.isMComparison(filter)) {
			const comparatorKey = Object.keys(filter)[0];
			const key = Object.keys((filter as any)[comparatorKey])[0];
			const targetValue = (filter as any)[comparatorKey][key];
			const keyParts = key.split("_");
			const sectionValue = section.get(keyParts[1]);

			if (sectionValue === undefined) {
				throw new Error("Attempted to compare an undefined value");
			}

			switch (comparatorKey) {
				case "LT": return sectionValue < targetValue;
				case "GT": return sectionValue > targetValue;
				case "EQ": return sectionValue === targetValue;
				default: throw new Error(`Unknown comparison: ${comparatorKey}`);
			}
		} else {
			throw new Error("Unknown filter type");
		}
	}

	public formatResults(sections: Section[], options: Options): any[] {
		// Step 1: Select the specified columns
		const results = sections.map((section) => {
			const result: any = {};
			options.COLUMNS.forEach((column) => {
				const colParts = column.split("_");
				result[column] = section.get(colParts[1]);
			});
			return result;
		});
		if (results.length > 5000) {
			throw new ResultTooLargeError("Oh no");
		}
		// Step 2: Sort the results if an ORDER key is specified
		if (options.ORDER) {
			const orderKey = options.ORDER;
			results.sort((a, b) => {
				if (a[orderKey] < b[orderKey]) {
					return -1;
				} else if (a[orderKey] > b[orderKey]) {
					return 1;
				} else {
					return 0;
				}
			});
		}

		return results;
	}

}
