export interface User {
	id: number;
	name: string;
	email: string;
}

export class UserService {
	private users: User[] = [];

	constructor() {
		this.users = [];
	}

	async getUser(id: number): Promise<User | undefined> {
		return this.users.find((user) => user.id === id);
	}

	async getAllUsers(): Promise<User[]> {
		return this.users;
	}

	async createUser(user: User): Promise<User> {
		this.users.push(user);
		return user;
	}

	async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
		const index = this.users.findIndex((user) => user.id === id);
		if (index !== -1) {
			this.users[index] = { ...this.users[index], ...updates };
			return this.users[index];
		}
		return undefined;
	}

	async deleteUser(id: number): Promise<boolean> {
		const index = this.users.findIndex((user) => user.id === id);
		if (index !== -1) {
			this.users.splice(index, 1);
			return true;
		}
		return false;
	}
}

export class UserController {
	constructor(private userService: UserService) {}

	async handleGetUser(id: number) {
		return this.userService.getUser(id);
	}

	async handleGetAllUsers() {
		return this.userService.getAllUsers();
	}
}
