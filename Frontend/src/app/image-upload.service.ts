import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../environments/environment';
import { Graph } from './model';

interface FullGraphResponse {
  full_graph: Graph;
}

@Injectable({
  providedIn: 'root',
})
export class ImageUploadService {
  private apiBaseUrl = environment.apiBaseUrl;

  private fullGraphSubject = new BehaviorSubject<Graph | null>(null);
  fullGraph$: Observable<Graph> = this.fullGraphSubject.asObservable();

  constructor(private http: HttpClient) {}

  uploadImage(base64Images: string[], imageNames: string[]): Observable<any> {
    const payload = {
      image_base64_array: base64Images,
      image_name_array: imageNames,
      rows: environment.imageSegmentation.rows,
      cols: environment.imageSegmentation.cols,
      overlap: environment.imageSegmentation.overlap,
    };

    return this.http.post(this.apiBaseUrl + '/upload', payload).pipe(
      tap((response: FullGraphResponse) => {
        this.fullGraphSubject.next(response.full_graph);
      })
    );
  }

  queryFullGraph() {
    this.http
      .get(this.apiBaseUrl + '/fullgraph')
      .pipe(
        tap((response: FullGraphResponse) => {
          this.fullGraphSubject.next(response.full_graph);
        })
      )
      .subscribe();
  }

  getFullGraph(): Observable<Graph> {
    return this.fullGraph$;
  }

  editGraph(payload: any) {
    return this.http.post(this.apiBaseUrl + '/editgraph', payload).pipe(
      tap((response: FullGraphResponse) => {
        this.fullGraphSubject.next(response.full_graph);
      })
    );
  }
}
