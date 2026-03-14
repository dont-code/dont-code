import {Injectable, signal} from '@angular/core';
import {webSocket, WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import {GenerateAppModel} from '../../model/generate-app';

@Injectable({
  providedIn: 'root',
})
export class GenerateAppService {
  protected socket: WebSocketSubject<string|GenerateAppModel> | null = null;

  generateApiUrl:string = "";
  protected connectionStatus = signal<string>("Not connected");

  protected openWebSocket (): Promise<WebSocketSubject<string|GenerateAppModel>> {
    // Check if there is one already opened
    if (this.socket!=null) {
      if (!this.socket.closed) {
        return Promise.resolve(this.socket);
      }
    }
    // If not, then check if we can open one
    if (this.generateApiUrl==null) {
      return Promise.reject("No Websocket Url to connect to")
    } else {
      const socketUrl=this.generateApiUrl;
      const ret = new Promise<WebSocketSubject<string|GenerateAppModel>>((resolve, reject) => {
        const config: WebSocketSubjectConfig<any> = {
          url: socketUrl,
          closeObserver: {
            next: value => {
              console.debug("Close", value);

            }
          },
          openObserver: {
            next: value => {
              if (this.socket)
                resolve(this.socket);
              else
                reject('No WebSocket');
            },
            error: err => {
              console.error("error connecting socket", err);
              reject(err);
            }
          }
        }

        this.socket = webSocket(config);
        this.connectionStatus.set("Connected");
        this.socket.asObservable().subscribe({
          next: msg => {

            console.debug('message received: ' , msg);
/*            const newId=msg?.sessionId;
            if ((newId) && (newId !== this.sessionId)){
              console.debug('Received SessionId ', newId);
              this.sessionId=newId;
              this.sessionIdSubject.next(newId);
            }*/
          },
          // Called whenever there is a message from the server
          error: err => {
            console.error(err);
            this.socket?.unsubscribe();
            this.connectionStatus.set("ERROR:" + err);
          },
          // Called if WebSocket API signals some kind of error
          complete: () => {
            console.debug('complete');
            this.socket?.unsubscribe();
            this.socket = null;
            this.connectionStatus.set("closed");
          }
          // Called when connection is closed (for whatever reason)
        });
      });
      return ret;
    }
  }

  async sendMessage (newChange:string): Promise<void> {
    return this.openWebSocket().then (socket => socket.next(newChange));
  }

}
