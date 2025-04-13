import { Server as SocketServer, Socket } from 'socket.io';

interface User {
    walletAddress: string;
    username: string;
    socketId: string;
}

interface TradeOffer {
    id: string;
    sellerName: string;
    sellerAddress: string;
    item: any; // Replace with proper Item type
    timestamp: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

let users: User[] = [];
let activeOffers: TradeOffer[] = [];

export const setupSocket = (io: SocketServer) => {
    io.on('connection', (socket: Socket) => {
        console.log('User connected:', socket.id);

        // Join handler
        socket.on('join', (data: { walletAddress: string; username: string }) => {
            const { walletAddress, username } = data;
            
            // Remove any existing connections for this user
            users = users.filter(user => user.walletAddress !== walletAddress);
            
            // Add the new connection
            users.push({
                walletAddress,
                username,
                socketId: socket.id
            });

            // Send current active offers to the new user
            socket.emit('activeOffers', activeOffers);
            
            // Broadcast updated online users list
            io.emit('onlineUsers', users.map(u => u.username));
            
            console.log(`${username} joined the marketplace`);
        });

        // Message handler
        socket.on('message', (data: { walletAddress: string; username: string; message: string }) => {
            socket.broadcast.emit('message', {
                id: Date.now(),
                sender_address: data.walletAddress,
                sender_name: data.username,
                message: data.message,
                created_at: new Date().toISOString()
            });
        });

        // Trade offer handlers
        socket.on('makeTradeOffer', (offer: TradeOffer) => {
            console.log('New trade offer received:', offer);
            activeOffers.push(offer);
            // Broadcast the new offer to all other users
            socket.broadcast.emit('newTradeOffer', offer);
        });

        socket.on('cancelTradeOffer', (offerId: string) => {
            console.log('Cancelling trade offer:', offerId);
            activeOffers = activeOffers.filter(offer => offer.id !== offerId);
            // Broadcast the cancellation to all users
            io.emit('tradeOfferCancelled', offerId);
        });

        socket.on('acceptTradeOffer', (data: { offerId: string; acceptedBy: string; acceptedByAddress: string }) => {
            console.log('Trade offer accepted:', data);
            const offer = activeOffers.find(o => o.id === data.offerId);
            
            if (offer) {
                // Update offer status
                offer.status = 'accepted';
                
                // Notify both parties
                const seller = users.find(u => u.walletAddress === offer.sellerAddress);
                const buyer = users.find(u => u.walletAddress === data.acceptedByAddress);
                
                if (seller) {
                    io.to(seller.socketId).emit('tradeOfferAccepted', {
                        offerId: data.offerId,
                        acceptedBy: data.acceptedBy
                    });
                }
                
                if (buyer) {
                    io.to(buyer.socketId).emit('tradeOfferAccepted', {
                        offerId: data.offerId,
                        acceptedBy: data.acceptedBy
                    });
                }

                // Remove the offer from active offers
                activeOffers = activeOffers.filter(o => o.id !== data.offerId);
                
                // Broadcast the acceptance to all users
                io.emit('tradeOfferAccepted', {
                    offerId: data.offerId,
                    acceptedBy: data.acceptedBy
                });
            }
        });

        // Disconnect handler
        socket.on('disconnect', () => {
            const user = users.find(u => u.socketId === socket.id);
            if (user) {
                console.log(`${user.username} disconnected`);
                // Remove user from users array
                users = users.filter(u => u.socketId !== socket.id);
                // Remove their active offers
                activeOffers = activeOffers.filter(offer => offer.sellerAddress !== user.walletAddress);
                // Broadcast updated online users list
                io.emit('onlineUsers', users.map(u => u.username));
            }
        });
    });
}; 