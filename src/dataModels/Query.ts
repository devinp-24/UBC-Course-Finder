// this interface was developed with the help of chatGPT
export interface Query {
	WHERE: Filter;
	OPTIONS: Options;
	TRANSFORMATION?: Transformations;
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
	[key: string]: number;
}
export interface SComparison {
	IS: SComparator;
}
export interface SComparator {
	[key: string]: string;
}
export interface Negation {
	NOT: Filter;
}

export interface Options {
	COLUMNS: string[];
	ORDER?: string | Order; // The ORDER can be a string or an Order object
}
export interface Order {
	dir: "UP" | "DOWN";
	keys: string[]; // For supporting multiple sort keys
}

export interface Transformations {
	GROUP: string[];
	APPLY: ApplyRule[];
}

export interface ApplyRule {
	[applyKey: string]: {
		[applyToken: string]: string;
	};
}

export type ApplyToken = Max | Min | Avg | Count | Sum;

export interface Max {
	MAX: string;
}

export interface Min {
	MIN: string;
}

export interface Avg {
	AVG: string;
}

export interface Count {
	COUNT: string;
}

export interface Sum {
	SUM: string;
}
