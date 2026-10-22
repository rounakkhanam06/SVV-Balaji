import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { customerAccessSecret } from '../storefront/customer-token.config';
import type { CustomerJwtPayload } from '../storefront/strategies/customer-jwt.strategy';
import { OrderEventsService } from './order-events.service';

const customerRoom = (customerId: string) => `customer:${customerId}`;

/**
 * Live order status for the customer app (Desi Tokri).
 *
 * Connect with `io('/customer', { auth: { token: <storefront access token> } })`.
 * The socket joins the room of the token's customer only.
 *
 * Events: `order:updated` ({ orderNumber, status }) on any order or delivery
 * step, and `order:otp-requested` ({ orderNumber }) when the rider at the door
 * asks for the delivery OTP. Both are nudges - the app refetches the order
 * over REST, which never sends the OTP to anyone but its owner.
 */
@WebSocketGateway({ namespace: '/customer', cors: { origin: true, credentials: true } })
export class CustomerOrdersGateway implements OnGatewayConnection, OnModuleInit {
  private readonly logger = new Logger(CustomerOrdersGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly events: OrderEventsService,
  ) {}

  onModuleInit(): void {
    this.events.on('new', (id) => void this.emitOrder('order:updated', id));
    this.events.on('updated', (id) => void this.emitOrder('order:updated', id));
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth as { token?: string } | undefined)?.token;
      if (!token) throw new Error('no token');
      const p = await this.jwt.verifyAsync<CustomerJwtPayload>(token, { secret: customerAccessSecret() });
      if (p.typ !== 'customer' || !p.sid) throw new Error('not a storefront token');
      const session = await this.prisma.customerSession.findUnique({ where: { id: p.sid }, select: { accountId: true, revokedAt: true, expiresAt: true } });
      if (!session || session.accountId !== p.sub || session.revokedAt || session.expiresAt <= new Date()) throw new Error('session gone');
      if (!p.customerId) throw new Error('no customer record');
      await client.join(customerRoom(p.customerId));
      client.emit('ready', { serverTime: new Date().toISOString() });
    } catch (error) {
      this.logger.debug(`Rejected socket ${client.id}: ${error instanceof Error ? error.message : String(error)}`);
      client.emit('unauthorized');
      client.disconnect(true);
    }
  }

  /** The rider at the door wants the code: bring it up on the customer's screen. */
  otpRequested(orderId: string): void {
    void this.emitOrder('order:otp-requested', orderId);
  }

  private async emitOrder(event: 'order:updated' | 'order:otp-requested', orderId: string) {
    try {
      const o = await this.prisma.order.findUnique({ where: { id: orderId }, select: { customerId: true, orderNumber: true, status: true } });
      if (!o?.customerId) return;
      this.server?.to(customerRoom(o.customerId)).emit(event, { orderNumber: o.orderNumber, status: o.status });
    } catch (error) {
      this.logger.warn(`Customer order broadcast failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
