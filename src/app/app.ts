import { afterNextRender, Component, computed, ElementRef, inject, signal, Signal, viewChild, viewChildren, ViewEncapsulation, WritableSignal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';

//Utils
import { 
  decimalMaxValidation,
  decimalMinValidation,
  decimalsValidation,
  integerValidation,
  percentageValidation
} from '@utils/form-validators';

import { AffordableLoam, LoamData, HouseState } from '@services/affordable-loam';

//External libraries 
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import {CountUpModule} from 'ngx-countup';

declare global {
  interface Window {
    html2pdf: any;
  }
}

@Component({
  selector: 'retirement-calculator',
  imports: [ReactiveFormsModule, CountUpModule, CurrencyPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class App {

  private fb = inject(FormBuilder);
  private currencyPipe = inject(CurrencyPipe);
  private affordableLoamService = inject(AffordableLoam);
  
  tooltips: Signal<readonly ElementRef<HTMLButtonElement>[]> = viewChildren<ElementRef<HTMLButtonElement>>('tooltip');
  resume: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('resume');
  list: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('list');
  table: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('table');

  loamForm: FormGroup = this.fb.group({
    monthlyIncome: ['',[Validators.required, decimalMinValidation(1), decimalMaxValidation(100_000),decimalsValidation]],
    otherExpenses: ['',[decimalMinValidation(0), decimalMaxValidation(100_000), decimalsValidation]],
    loamInterest: ['', [decimalsValidation, percentageValidation]],
    loamYears: ['',[Validators.required, Validators.min(5), Validators.max(50), integerValidation]],
    loamState: ['new'],
    loamUbication: ['andalucia']
  })

  houseStateEnum = HouseState;
  results = computed(()=> this.affordableLoamService.loamResult());
  isGeneratingPdf:WritableSignal<boolean> = signal(false);
  isCalculating:WritableSignal<boolean> = signal(false);
  isShowTable:WritableSignal<boolean> = signal(false);

  constructor(){
    afterNextRender(() => {
      this.createTooltips(this.tooltips());
    });
  }

  createTooltips(tooltips: readonly ElementRef<HTMLButtonElement>[]):void{
    tooltips.forEach((tooltip) =>{
      const type = tooltip.nativeElement.getAttribute('data-tooltip-type');
      
      switch(type){
        
        case 'monthlyIncome':
          tippy(tooltip.nativeElement, {
            content: 'Tus ingresos mensuales netos después de pagar impuestos.',
            animation: 'scale'
          })
        break;

        case 'otherExpenses':
          tippy(tooltip.nativeElement, {
            content: 'Indica el importe de otros préstamos personales o de tarjeta de crédito que tengas',
            animation:'scale'
          })
        break;

        case 'loamInterest':
          tippy(tooltip.nativeElement, {
            content: 'El interés al que esperas conseguir la hipoteca. Si no lo sabes déjalo en blanco',
            animation:'scale'
          })
        break;

        case 'loamYears':
          tippy(tooltip.nativeElement, {
            content: 'Los años a los que piensas hipotecarte. Si no lo sabes déjalo en blanco',
            animation:'scale'
          })
        break;
        
        case 'loamUbication':
          tippy(tooltip.nativeElement, {
            content: 'La ubicación de la propiedad',
            animation:'scale'
          })
        break;

      }

    })
  }
  
  showTable( show:boolean ):void {
    const table = this.table();
    if(table){
      if(show){
        this.isShowTable.set(true);
        table.nativeElement.classList.remove('hidden');
        table.nativeElement.scrollIntoView({behavior: 'smooth'});
      }else{
        this.isShowTable.set(false);
        table.nativeElement.classList.add('hidden');
      }
    } 
  }

  onSubmit():void {
    if(this.loamForm.invalid){ 
      this.loamForm.markAllAsTouched();
      return;
    }

    this.showTable(false);
    this.isCalculating.set(true);
    const normalized_values= this.normalizeValues(this.loamForm);
    this.affordableLoamService.loamData.set(normalized_values);
    this.isCalculating.set(false);
    
    const resume = this.resume();
    if(resume) resume.nativeElement.scrollIntoView({behavior: 'smooth'});
  }

  isValidField( fieldName: string ): boolean | null {
    return (this.loamForm.controls[fieldName].errors && this.loamForm.controls[fieldName].touched);
  }

  getFieldError( fieldName:string ): string | null{

    if(!this.loamForm.controls[fieldName]) return null; //If there is no field with that name
    
    const errors = this.loamForm.controls[fieldName].errors ?? {};

    for(const key in errors){

      switch(key){
        case 'required':
          return 'Este campo es requerido';
        
        case 'min':
          return `El mínimo es ${this.currencyPipe.transform(errors['min'].min, 'EUR', 'symbol', '1.2-2')}`;

        case 'max':
          return `El máximo es ${this.currencyPipe.transform(errors['max'].max, 'EUR', 'symbol', '1.2-2')}`;
        
        case 'decimal':
        case 'decimals':
        case 'integer':
          return `Introduce un número válido`;
        
        case 'percentage':
          return `Introduce un porcentage entre 0,01% y 100%`

        default: 
          return null;
        
      }

    }

    return null;
  }

  normalizeValues( form:FormGroup ): LoamData{
    console.log(form);
    let values: { [key:string]: string|number } = {...form.value};    

    for(const control in values){

      switch(control){

        case 'monthlyIncome':
          values[control] = this.normalizeNumber(values[control], true)
        break;

        case 'otherExpenses':
          if(values[control]){
            values[control] = this.normalizeNumber(values[control], true)
          }else{
            values[control] = 0;
          }
        break;

        case 'loamInterest':
          if(values[control]){
            values[control] = this.normalizeNumber(values[control], true)
          }else{
            values[control] = 2.5;
          }
          
        break;

        case 'loamYears':
          values[control] = this.normalizeNumber(values[control], true)
        break;

      }

    }

    return values as LoamData;
  }

  normalizeNumber<T>(value:T, isDecimal:boolean): number|T {

    if(typeof value !== 'string'){
      return value;
    }
  
    if(isDecimal){
      const numeric_value = value.replaceAll(',','.');
      return parseFloat(numeric_value)
    }

    return parseInt(value);
  }

  async generatePdf() {
    this.isGeneratingPdf.set(true);
  
    const viewResume = this.resume();
    if (!viewResume) return;
  
    const viewList = this.list();
    if (!viewList) return;
  
    const viewTable = this.table();
    if (!viewTable) return;
  
    const resumeToPrint = viewResume.nativeElement.cloneNode(true) as HTMLElement;
    const button = resumeToPrint.querySelector('#downloadPdf') as HTMLElement;
    if (button) button.classList.add('hidden');
  
    const listToPrint = viewList.nativeElement.cloneNode(true) as HTMLElement;
    const text = listToPrint.querySelector('#loam-text');
    const listItems = listToPrint.querySelector('#list-items');
    if (listItems) listItems.classList.remove('lg:w-2/4', 'xl:w-2/3');
    if (text) text.remove();
  
    const tableToPrint = viewTable.nativeElement.cloneNode(true) as HTMLElement;
    tableToPrint.classList.remove('hidden');
  
    const printHtml = `
      <div style="width:794px;max-width:100%;">
        ${resumeToPrint.outerHTML}
        ${listToPrint.outerHTML}
        ${tableToPrint.outerHTML}
      </div>
    `;
  
    const globalStylesView = document.querySelector('#affordable-styles');
    let globalTailwindStyles = '';
    if (globalStylesView && globalStylesView.tagName === 'LINK') {
      const link = globalStylesView as HTMLLinkElement;
      if (link.href) {
        globalTailwindStyles = `<link rel="stylesheet" href="${link.href}">`;
      }
    }
    
    if (!globalTailwindStyles) {
      const headLinks = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]'));
      const headStyles = Array.from(document.head.querySelectorAll('style'));
      globalTailwindStyles =
        headLinks
          .map(link => `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}">`)
          .join('\n') +
        headStyles
          .map(style => `<style>${(style as HTMLStyleElement).innerHTML}</style>`)
          .join('\n');
    }
  
    
    const printWindow = window.open('', '_blank', 'width=1,height=1,top=10000,left=10000');
    if (!printWindow) {
      this.isGeneratingPdf.set(false);
      console.error("No se pudo abrir la ventana para imprimir.");
      return;
    }
  
    printWindow.document.write(`
      <html>
        <head>
          ${globalTailwindStyles}
          <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
        </head>
        <body>
          ${printHtml}
          <script>
            window.onload = function() {
              const opt = {
                pagebreak: { mode: ["avoid-all", "css", "legacy"] },
                margin: 0.2,
                filename: 'cuadro-amortizacion.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 1, logging: true, scrollY: 0 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
              };
              const el = document.body.firstElementChild;
              window.html2pdf().set(opt).from(el).save().then(() => {
                window.close();
              });
            }
          </script>
        </body>
      </html>
    `);
  
    printWindow.document.close();
  
    
    setTimeout(() => {
      this.isGeneratingPdf.set(false);
    }, 5000);
  }

}