import { ObjectId } from "mongodb";

export default class UserProfile {
  constructor(
    public userId: string,
    public currentState: string,
    public _id?: ObjectId,
  ) {}
} 