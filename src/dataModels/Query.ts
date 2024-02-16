export interface Query {
	WHERE: Filter;
	OPTIONS: Options;
	// Include TRANSFORMATIONS if your EBNF supports it
}
export type Filter = LogicComparison | MComparison | SComparison | Negation ;
export interface LogicComparison {
	AND?: Filter[];
	OR?: Filter[];
}
export interface MComparison {
	LT?: MComparator;
	GT?: MComparator;
	EQ?: MComparator;
}
export interface MComparator {
	[key: string]: number; // e.g., "courses_avg": 90
}
export interface SComparison {
	IS: SComparator;
}
export interface SComparator {
	[key: string]: string; // e.g., "courses_dept": "cpsc"
}
export interface Negation {
	NOT: Filter;
}

export interface Options {
	COLUMNS: string[];
	ORDER?: string; // Extend as needed for more complex ordering
	[key: string]: any;
}

