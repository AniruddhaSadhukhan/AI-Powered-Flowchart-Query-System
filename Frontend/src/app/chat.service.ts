import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private apiBaseUrl = environment.apiBaseUrl;
  private relevantSubgraphSubject = new Subject<any>();

  constructor(private http: HttpClient) {}

  sendMessage(
    message: string,
    conversationContext: any,
    useRelevantContext = true
  ): Observable<any> {
    return this.http
      .post(`${this.apiBaseUrl}/query`, {
        user_input: message,
        conversation_history: conversationContext,
        use_relevant_context: useRelevantContext,
      })
      .pipe(
        tap((response: any) => {
          this.relevantSubgraphSubject.next(response.relevant_subgraph);
        })
      );
  }

  getRelevantSubgraph(): Observable<any> {
    return this.relevantSubgraphSubject.asObservable();
  }
}
