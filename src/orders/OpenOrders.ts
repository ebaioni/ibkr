import chalk from 'chalk';
import { ContractObject } from '../contracts/contracts.interfaces';
import { ORDER, OrderState, OrderWithContract, OrderStatus } from './orders.interfaces';
import { IbkrEvents, IBKREVENTS, publishDataToTopic } from '../events';
import { log } from '../log';
import IBKRConnection from '../connection/IBKRConnection';
import { OrderTrade } from './OrderTrade';

const appEvents = IbkrEvents.Instance;


export default class OpenOrders {

    ib: any;

    receivedOrders: boolean = false;

    public orders: { [x: string]: OrderWithContract } = {};

    private static _instance: OpenOrders;

    public static get Instance() {
        return this._instance || (this._instance = new this());
    }

    private constructor() { }

    public init() {
        let self = this;
        self.ib = IBKRConnection.Instance.getIBKR();

        const ib = self.ib;

        ib.on('openOrder', function (orderId, contract: ContractObject, order: ORDER, orderState: OrderState) {
            log(`AccountOpenOrders.openOrder`, chalk.red(` -> ${contract.symbol} ${order.action} ${order.totalQuantity}  ${orderState.status}`));

            self.receivedOrders = true;

            let orders = self.orders;

            self.orders = {
                ...orders,
                [orderId]: {
                    ...(orders && orders[orderId] || null),

                    // OrderId + orderState
                    orderId,
                    orderState,

                    // Add order
                    ...order,
                    // Add contract
                    ...contract
                }
            };

            const openOrders = Object.keys(self.orders).map(key => self.orders[key]);

            publishDataToTopic({
                topic: IBKREVENTS.GET_OPEN_ORDERS,
                data: openOrders,
            });

            log(chalk.black(`OPEN ORDERS ${openOrders && openOrders.length}`))
        });

        ib.on('orderStatus', (id, status, filled, remaining, avgFillPrice, permId,
            parentId, lastFillPrice, clientId, whyHeld) => {

            const currentOrder = self.orders[id];

            const orderStatus: OrderStatus = {
                status, filled, remaining, avgFillPrice, permId,
                parentId, lastFillPrice, clientId, whyHeld
            }

            publishDataToTopic({
                topic: IBKREVENTS.ORDER_STATUS, //push to topic below,
                data: {
                    order: currentOrder,
                    orderStatus
                }
            });

            log(chalk.black(`orderStatus`))
        });

        self.reqAllOpenOrders();

        // Initialise OrderTrader
        OrderTrade.Instance;

    }

    /**
     *  reqAllOpenOrders
     */
    public reqAllOpenOrders = () => {
        console.log(`AccountOpenOrders.getOpenOrders init`, chalk.black(`reqAllOpenOrders`))
        this.ib.reqAllOpenOrders();
    }

    getOpenOrders(): OrderWithContract[] {
        appEvents.emit(IBKREVENTS.GET_OPEN_ORDERS, { data: true })
        const openOrders = Object.keys(this.orders).map(key => this.orders[key])
        return openOrders;
    }

    /**
 * getPortfolios
 */
    // public getOpenOrders(): Promise<ORDER[]> {
    //     const { orders, reqAllOpenOrders } = this;
    //     const openOrders = Object.keys(orders).map(key => this.orders[key])
    //     return new Promise((resolve, reject) => {

    //         if (!isEmpty(openOrders)) {
    //             return resolve(openOrders);
    //         }

    //         // listen for account summary
    //         const handleOpenOrders = (accountSummaryData) => {
    //             appEvents.off(APPEVENTS.GET_OPEN_ORDERS, handleOpenOrders);
    //             resolve(accountSummaryData);
    //         }
    //         appEvents.on(APPEVENTS.GET_OPEN_ORDERS, handleOpenOrders);

    //         reqAllOpenOrders();
    //     })

    // }



    isActive(): boolean {
        return this.receivedOrders;
    }
}