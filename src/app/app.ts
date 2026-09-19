import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import {HttpClient} from '@angular/common/http';

@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('angular-devtools');

  couter = signal(0);

  http= inject(HttpClient).get('https://jsonplaceholder.typicode.com/posts')
}
