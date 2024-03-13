export default class Room {

	private readonly fullname: string;
	private readonly shortname: string;
	private readonly num: string;
	private readonly name: string;
	private readonly address: string;
	private readonly lat: number;
	private readonly lon: number;
	private readonly seats: number;
	private readonly typ: string;
	private readonly furniture: string;
	private readonly href: string;

	constructor(fullname: string, shortname: string, num: string, name: string, address: string,
		lat: number, lon: number, seats: number, typ: string, furniture: string, href: string) {
		this.fullname = fullname;
		this.shortname = shortname;
		this.num = num;
		this.name = name;
		this.address = address;
		this.lat = lat;
		this.lon = lon;
		this.seats = seats;
		this.typ = typ;
		this.furniture = furniture;
		this.href = href;
	}

	public get(keyID: string) {
		if (keyID === "fullname") {
			return this.fullname;
		} else if (keyID === "shortname") {
			return this.shortname;
		} else if (keyID === "number") {
			return this.num;
		} else if (keyID === "name") {
			return this.name;
		} else if (keyID === "address") {
			return this.address;
		} else if (keyID === "lat") {
			return this.lat;
		} else if (keyID === "lon") {
			return this.lon;
		} else if (keyID === "seats") {
			return this.seats;
		} else if (keyID === "type") {
			return this.typ;
		} else if (keyID === "furniture") {
			return this.furniture;
		} else if (keyID === "href") {
			return this.href;
		} else {
			return undefined;
		}
	}
}
