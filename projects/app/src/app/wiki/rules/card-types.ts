import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';

@Component({
  selector: 'app-rules-card-types',
  imports: [RouterLink, RichText, TPipe],
  styleUrl: './rules-page.css',
  template: `
    <h2>{{ 'nav.rules.cardTypes' | t }}</h2>
    <p class="lead">{{ 'rules.cardTypes.lead' | t }}</p>
    <table>
      <tr>
        <th><a routerLink="/wiki/generals">{{ 'rules.cardTypes.general' | t }}</a></th>
        <td><app-rich key="rules.cardTypes.generalText" /></td>
      </tr>
      <tr>
        <th><a routerLink="/wiki/basic">{{ 'rules.cardTypes.basic' | t }}</a></th>
        <td><app-rich key="rules.cardTypes.basicText" /></td>
      </tr>
      <tr>
        <th><a routerLink="/wiki/tools">{{ 'rules.cardTypes.tools' | t }}</a></th>
        <td><app-rich key="rules.cardTypes.toolsText" /></td>
      </tr>
      <tr>
        <th><a routerLink="/wiki/equipment">{{ 'rules.cardTypes.equipment' | t }}</a></th>
        <td><app-rich key="rules.cardTypes.equipmentText" /></td>
      </tr>
    </table>
    <p><app-rich key="rules.cardTypes.see" /></p>
  `,
})
export class RulesCardTypes {}
