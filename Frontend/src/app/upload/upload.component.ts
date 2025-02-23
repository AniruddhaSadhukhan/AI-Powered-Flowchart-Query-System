import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { crc32 } from 'crc';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { PrimeNG } from 'primeng/config';
import { FileUpload } from 'primeng/fileupload';
import { ProgressBar } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { ImageUploadService } from '../image-upload.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [
    FileUpload,
    ButtonModule,
    BadgeModule,
    ProgressBar,
    ToastModule,
    HttpClientModule,
    CommonModule,
  ],
  providers: [MessageService],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.scss',
})
export class UploadComponent {
  pendingFiles = [];
  uploadedFiles = [];

  progress: number = 0;

  constructor(
    private config: PrimeNG,
    private messageService: MessageService,
    private imageUploadService: ImageUploadService
  ) {}

  getUploadStatusBasedOnProgress(progress) {
    if (progress === 100) {
      return 'Uploaded';
    } else if (progress > 90) {
      return 'Merging results from all images';
    } else if (progress > 75) {
      return 'Saving results';
    } else if (progress > 50) {
      return 'Analyzing image(s)';
    } else if (progress > 25) {
      return 'Upload in progress';
    } else if (progress > 0) {
      return 'Image(s) ready for upload';
    }

    return 'Please select image(s) to upload';
  }

  choose(event, callback) {
    callback();
  }

  onRemoveTemplatingFile(event, file, removeFileCallback, index) {
    removeFileCallback(event, index);
  }

  onClearTemplatingUpload(clear) {
    clear();
    this.progress = 0;
  }

  onTemplatedUpload(event: any) {
    const files = event.files;
    const base64Images: string[] = [];
    const imageNames: string[] = [];

    files.forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        base64Images.push(base64String);

        // File name = File name + crc32hash(base64String)
        const hash = crc32(base64String).toString(16);
        const newFileName = `${file.name}-${hash}`;

        imageNames.push(newFileName);
        console.log('File name: ', newFileName);

        if (base64Images.length === files.length) {
          const interval = setInterval(() => {
            if (this.progress < 97) {
              this.progress += 1;
            }
          }, 1000);

          this.imageUploadService
            .uploadImage(base64Images, imageNames)
            .subscribe(
              (response) => {
                this.messageService.add({
                  severity: 'info',
                  summary: 'Success',
                  detail: 'File(s) Uploaded',
                  life: 3000,
                });

                this.pendingFiles = [];
                this.uploadedFiles = event.files;

                clearInterval(interval);
                this.progress = 100;
              },
              (error) => {
                this.messageService.add({
                  severity: 'error',
                  summary: 'Error',
                  detail: 'File Upload Failed',
                  life: 3000,
                });
              }
            );
        }
      };
      reader.readAsDataURL(file);
    });
  }

  onSelectedFiles(event) {
    this.pendingFiles = event.currentFiles;
    this.progress = 25;
  }

  uploadEvent(callback) {
    callback();
  }

  formatSize(bytes) {
    const k = 1024;
    const dm = 3;
    const sizes = this.config.translation.fileSizeTypes;
    if (bytes === 0) {
      return `0 ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${formattedSize} ${sizes[i]}`;
  }
}
