// this interface was developed with the help of chatGPT
export interface Query {
	WHERE: Filter;
	OPTIONS: Options;
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
	ORDER?: string;
	[key: string]: any;
}

