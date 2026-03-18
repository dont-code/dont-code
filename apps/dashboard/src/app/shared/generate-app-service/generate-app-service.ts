import {computed, inject, Injectable, signal} from '@angular/core';
import {webSocket, WebSocketSubject, WebSocketSubjectConfig} from 'rxjs/webSocket';
import {ConfigService} from '../config-service/config-service';

@Injectable({
  providedIn: 'root',
})
export class GenerateAppService {
  protected config = inject(ConfigService);

  protected socket: WebSocketSubject<any> | null = null;

  protected receivers: Array<{id:number, next:(msg:any) => void, error:(err:Error) => void}> = [];

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

  protected openWebSocket (): Promise<WebSocketSubject<any>> {
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
      const ret = new Promise<WebSocketSubject<any>>((resolve, reject) => {
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
              receiver.next(msg);
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
            for (const receiver of this.receivers) {
              receiver.error(err);
            }
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

  messageReceiver(receiver: (response:any) => void, error:(err:Error) => void):number {
    const toAdd={id:0,next:receiver, error:error};
    let nextId=0;
    for (const receiver of this.receivers) {
      if (receiver.id >= nextId) {
        nextId = receiver.id+1;
      }
    }
    toAdd.id=nextId;
    this.receivers.push(toAdd);
    return nextId;
  }


  removeReceiver(toRemoveId: number) {
    let pos=0;
    for (const toRemove of this.receivers) {
      if (toRemove.id==toRemoveId) {
        this.receivers= this.receivers.splice(pos, 1);
        break;
      }
      pos++;
    }
  }
}
