import { Player } from "./Player";

export type Room = {
  name: string;
  players: { [key in string]: Player };
  gameId: string;
}
