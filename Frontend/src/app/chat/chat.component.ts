import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';
import { Checkbox } from 'primeng/checkbox';
import { PanelModule } from 'primeng/panel';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ChatService } from '../chat.service';
import { ChatResponse } from '../model';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Checkbox,
    PanelModule,
    TextareaModule,
    HttpClientModule,
    TagModule,
    MarkdownComponent,
  ],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
})
export class ChatComponent {
  @ViewChild('chatWindow') private chatWindow: ElementRef;
  @ViewChild('userInputField') private userInputElement: ElementRef;

  useRelevantContext = true;

  messages = [];
  conversationContext = [];
  userInput: string;
  loading: boolean = false;
  inputDisabled: boolean = false;

  constructor(private chatService: ChatService) {}

  addMessageToContext(message: string, role: string) {
    this.conversationContext.push({ role: role, content: message });
  }

  sendMessage() {
    if (this.userInput.trim()) {
      let userInput = this.userInput.trim();
      this.messages.push({ text: userInput, sender: 'user' });
      this.loading = true;
      this.inputDisabled = true;

      this.scrollToBottom();

      // Add a temporary loading message
      const loadingMessage = { text: '', sender: 'system', sources: [] };
      this.messages.push(loadingMessage);

      this.chatService
        .sendMessage(
          userInput,
          this.conversationContext,
          this.useRelevantContext
        )
        .subscribe(
          (response: ChatResponse) => {
            loadingMessage.text = response.response;
            // remove hash from image names
            loadingMessage.sources = response.image_names.map((name) =>
              name.slice(0, -9)
            );
            this.loading = false;
            this.addMessageToContext(userInput, 'user');
            this.addMessageToContext(
              JSON.stringify({
                text: response.response,
                imageSources: response.image_names,
              }),
              'assistant'
            );
            this.inputDisabled = false;
            this.scrollToBottom();
            this.focusOnTextInput();
          },
          (err) => {
            console.error('Error sending message:', err);
            loadingMessage.text = 'An error occurred. Please try again.';
            this.loading = false;
            this.inputDisabled = false;
            this.scrollToBottom();
            this.focusOnTextInput();
          }
        );

      this.userInput = '';
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        this.chatWindow.nativeElement.scrollTop =
          this.chatWindow.nativeElement.scrollHeight;
      } catch (err) {
        console.error('Could not scroll to bottom:', err);
      }
    }, 100);
  }

  private focusOnTextInput(): void {
    setTimeout(() => {
      this.userInputElement.nativeElement.focus();
    }, 100);
  }
}
