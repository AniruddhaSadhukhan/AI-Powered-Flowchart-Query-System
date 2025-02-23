import { HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { PanelModule } from 'primeng/panel';
import { SplitterModule } from 'primeng/splitter';
import { StepperModule } from 'primeng/stepper';
import { TabsModule } from 'primeng/tabs';
import { Toolbar } from 'primeng/toolbar';
import { ChatComponent } from './chat/chat.component';
import { GraphComponent } from './graph/graph.component';
import { UploadComponent } from './upload/upload.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HttpClientModule,
    PanelModule,
    SplitterModule,
    StepperModule,
    Checkbox,
    TabsModule,
    ButtonModule,
    Toolbar,
    ChatComponent,
    FormsModule,
    UploadComponent,
    GraphComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  showRelevantImages = true;
}
