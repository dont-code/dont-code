import {computed, inject, Injectable, signal} from '@angular/core';
import {webSocket, WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import {ConfigService} from '../config-service/config-service';

@Injectable({
  providedIn: 'root',
})
export class GenerateAppService {
  protected config = inject(ConfigService);

  protected socket: WebSocketSubject<string> | null = null;

  protected receivers: Array<(msg:string) => void> = [];

  generateApiUrl = computed(() => {
    return this.config.repository.value()?.generateApiUrl;
  });

  manageSocket= computed (() => {
    const apiUrl = this.generateApiUrl();
    if (this.socket!=null) {
      this.socket.complete();
      this.socket=null;
      this.connectionStatus.set("Disconnected");
    }
  });

  protected connectionStatus = signal<string>("Not connected");

  protected openWebSocket (): Promise<WebSocketSubject<string>> {
    // Check if there is one already opened
    if (this.socket!=null) {
      if (!this.socket.closed) {
        return Promise.resolve(this.socket);
      }
    }
    // If not, then check if we can open one
    const socketUrl=this.generateApiUrl();
    if (socketUrl==null) {
      return Promise.reject("No Websocket Url to connect to")
    } else {
      const ret = new Promise<WebSocketSubject<string>>((resolve, reject) => {
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
            for (const receiver of this.receivers) {
              receiver(msg);
            }
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

  messageReceiver(receiver: (response:string) => void):number {
    return this.receivers.push(receiver);
  }


}
