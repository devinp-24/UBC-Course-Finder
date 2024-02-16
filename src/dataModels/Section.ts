export default class Section {

	private readonly uuid: string;
	private readonly course_id: string;
	private readonly title: string;
	private readonly instructor: string;
	private readonly dept: string;
	private readonly year: number;
	private readonly avg: number;
	private readonly pass: number;
	private readonly fail: number;
	private readonly audit: number;

	constructor(uuid: string, course_id: string, title: string, instructor: string, dept: string,
		year: number, avg: number, pass: number, fail: number, audit: number) {
		this.uuid = uuid;
		this.course_id = course_id;
		this.title = title;
		this.instructor = instructor;
		this.dept = dept;
		this.year = year;
		this.avg = avg;
		this.pass = pass;
		this.fail = fail;
		this.audit = audit;
	}

	public get(keyID: string) {
		if (keyID === "uuid") {
			return this.uuid;
		} else if (keyID === "id") {
			return this.course_id;
		} else if (keyID === "title") {
			return this.title;
		} else if (keyID === "instructor") {
			return this.instructor;
		} else if (keyID === "dept") {
			return this.dept;
		} else if (keyID === "year") {
			return this.year;
		} else if (keyID === "avg") {
			return this.avg;
		} else if (keyID === "pass") {
			return this.pass;
		} else if (keyID === "fail") {
			return this.fail;
		} else if (keyID === "audit") {
			return this.audit;
		} else {
			return;
		}
	}
}
