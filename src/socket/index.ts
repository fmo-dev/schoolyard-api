import {
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { Room } from './Room';
import { Player } from './Player';

@WebSocketGateway({ cors: true })
export class SocketService implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private rooms: { [key in string]: Room } = {};
    private players: Player[] = [];

    afterInit() {
        setInterval(() => {
            Object.keys(this.rooms).forEach(key => {
                const room = this.rooms[key];
                if (!Object.keys(room.players).length) {
                    delete this.rooms[key];
                }
            })
        }, 5000)
    }

    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('SocketService');

    @SubscribeMessage('createRoom')
    createRoom(client: Socket, gameId: string = "0"): void {
        try {
            const roomName = this.createRoomName();
            const player = this.players.find(current => current.id == client.id);
            this.rooms[roomName] = {
                name: roomName,
                players: { [client.id]: player },
                gameId
            }
            player.currentRoom = roomName;
            this.server.emit('roomCreated', this.rooms[roomName]);
        }
        catch (err) {
            this.server.emit("roomCreated", { name: "NO_ROOM_AVAILABLE" });
        }
    }

    @SubscribeMessage('joinRoom')
    joinRoom(client: Socket, roomName: string): void {
        const player = this.getPlayer(client.id);
        if (this.rooms[roomName]) {
            if (!this.rooms[roomName].players[client.id]) {
                this.rooms[roomName].players[client.id] = player;
                player.currentRoom = roomName;
                this.server.emit(`roomUpdated_${roomName}`, this.rooms[roomName]);
                this.server.emit('roomJoined', this.rooms[roomName]);
            }
        }
        else this.server.emit("roomJoined", { name: "DOESN_T_EXIST" });
    }

    @SubscribeMessage('updateUsername')
    updateName(client: Socket, username: string) {
        const player = this.getPlayer(client.id);
        player.username = username;
        if (player.currentRoom) {
            this.updateRoom(player.currentRoom);
        }
    }

    handleDisconnect(client: Socket) {
        const player = this.getPlayer(client.id);
        if (player.currentRoom) {
            delete this.rooms[player.currentRoom].players[client.id];
            this.updateRoom(player.currentRoom);
        }
        const personIndex = this.getPlayerIndex(client.id);
        if (personIndex > -1) this.players.splice(personIndex, 1);
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    handleConnection(client: Socket) {
        this.players.push({ id: client.id, username: '' });
        this.logger.log(`Client connected: ${client.id}`);
        this.server.emit("onInit");
    }

    private updateRoom = (roomName: string) => this.server.emit(`roomUpdated_${roomName}`, this.rooms[roomName]);

    private getPlayer = (id: string) => this.players.find(current => current.id == id);

    private getPlayerIndex = (id: string) => this.players.findIndex(current => current.id == id);

    private createRoomName() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split('');
        const roomNameLength = 4;
        const name = this.findUnusedName(chars, "", chars.length, roomNameLength);
        if (!name) throw new Error("NO_ROOM_AVAILABLE");
        else return name;
    }

    private findUnusedName(chars: string[], prefix: string, totalChars: number, length: number) {
        if (length == 0) {
            return this.rooms[prefix] ? null : prefix
        }
        for (let i = 0; i < totalChars; ++i) {
            const newPrefix = prefix + chars[i];
            const check = this.findUnusedName(chars, newPrefix, totalChars, length - 1);
            if (check) return check;
        }
    }
}