import { afterNextRender, Component, computed, effect, ElementRef, inject, signal, Signal, viewChild, viewChildren, ViewEncapsulation, WritableSignal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';

//Utils
import { 
  decimalMaxValidation,
  decimalMinValidation,
  decimalsValidation,
  integerValidation,
  percentageValidation
} from '@utils/form-validators';

import { RetirementSaves, RegimeType, RetirementData } from '@services/retirement-saves';

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
  selector: 'loam-calculator',
  imports: [ReactiveFormsModule, CountUpModule, CurrencyPipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  encapsulation: ViewEncapsulation.ShadowDom,
})
export class App {

  private fb = inject(FormBuilder);
  private currencyPipe = inject(CurrencyPipe);
  private retirementSavesService = inject(RetirementSaves);

  currentStep: WritableSignal<number> = signal(1);
  firstStep: Signal<ElementRef<HTMLElement>|undefined> = viewChild<ElementRef<HTMLElement>>('firstStep');
  secondStep: Signal<ElementRef<HTMLElement>|undefined> = viewChild<ElementRef<HTMLElement>>('secondStep');
  thirdStep: Signal<ElementRef<HTMLElement>|undefined> = viewChild<ElementRef<HTMLElement>>('thirdStep');
  
  tooltips: Signal<readonly ElementRef<HTMLButtonElement>[]> = viewChildren<ElementRef<HTMLButtonElement>>('tooltip');
  resume: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('resume');
  list: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('list');
  table: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>('table');

  retirementForm: FormGroup = this.fb.group({
    currentAge: ['', [Validators.required, Validators.min(16), Validators.max(85), integerValidation]],
    yearlyIncome: ['', [Validators.required, decimalMinValidation(12000), decimalsValidation]],
    yearsContributing: ['', [Validators.required, Validators.min(0), Validators.max(70), integerValidation]],
    regime: ['ajena'],
    annualSalaryIncrease: ['', [decimalsValidation, percentageValidation]],
    annualInflation: ['', [decimalsValidation, percentageValidation]],
    retirementAge: ['', [Validators.required, Validators.min(63), integerValidation]],
    retirementMonthlyObjective: ['', [Validators.required, decimalsValidation]],
    currentSaves: ['', [decimalMinValidation(0), decimalsValidation]],
    currentSavesMonthly: ['', [decimalMinValidation(0), decimalsValidation]],
    currentReturn: ['', [decimalsValidation, percentageValidation]]
  },
  // {
  //   validators: this.retirementMonthlyIsGreater('retirementMonthlyObjective', 'yearlyIncome')
  // }
  )

  regimeTypeEnum = RegimeType;
  results: WritableSignal<any> = signal(null);
  //results = computed(()=> this.retirementSavesService.retirementResult());
  isGeneratingPdf:WritableSignal<boolean> = signal(false);
  isCalculating:WritableSignal<boolean> = signal(false);
  isShowTable:WritableSignal<boolean> = signal(false);

  constructor(){

    effect(()=>{
      const tooltips = this.tooltips();
      this.createTooltips(tooltips);
    })

    afterNextRender(() => {
      this.createTooltips(this.tooltips());
    });
  }

  resetResult(): void{
    this.results.set(null);
  }

  nextStep():void {
    if(this.currentStep() >= 3) return;
    this.currentStep.update(step => step + 1);
  }

  previousStep():void {
    if(this.currentStep() <= 1) return;
    this.currentStep.update(step => step - 1);
  }

  verifyStep(step:number): boolean {
    
    switch(step){
      case 1:
        const currentAge = this.retirementForm.get('currentAge');
        const yearlyIncome = this.retirementForm.get('yearlyIncome');
        const yearsContributing = this.retirementForm.get('yearsContributing');
        const annualSalaryIncrease = this.retirementForm.get('annualSalaryIncrease');
        const annualInflation = this.retirementForm.get('annualInflation');
        
      return !!(currentAge?.valid && yearlyIncome?.valid && yearsContributing?.valid && annualSalaryIncrease?.valid && annualInflation?.valid);
      
      case 2: 
        const retirementAge = this.retirementForm.get('retirementAge');
        const retirementMonthlyObjective = this.retirementForm.get('retirementMonthlyObjective');

        return !!(retirementAge?.valid && retirementMonthlyObjective?.valid);

      case 3:
        const currentSaves = this.retirementForm.get('currentSaves');
        const currentSavesMonthly = this.retirementForm.get('currentSavesMonthly');
        const currentReturn = this.retirementForm.get('currentReturn');

        return !!(currentSaves?.valid && currentSavesMonthly?.valid && currentReturn?.valid);

      default:
        return false;
    }
  }

  abs(number:number):number {
    return Math.abs(number);
  }

  retirementMonthlyIsGreater( monthly:string, annual:string ): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const monthlyPay = group.get(monthly);
      const annualPay = group.get(annual);
  
      if(monthlyPay !== null && annualPay !== null && monthlyPay.value !== null && annualPay.value !== null){
        const monthlyAnnualPay = parseFloat((annualPay.value / 12).toFixed(2));
        if(monthlyPay.value < monthlyAnnualPay) return { retirementMonthlyIsGreater: { min: monthlyAnnualPay, actual: monthlyPay, total: annualPay.value } }
      }
  
      return null
    }
  }

  createTooltips(tooltips: readonly ElementRef<HTMLButtonElement>[]):void{
    tooltips.forEach((tooltip) =>{
      const type = tooltip.nativeElement.getAttribute('data-tooltip-type');
      
      switch(type){          
        
        case 'yearlyIncome':
          tippy(tooltip.nativeElement, {
            content: 'Indica tu salario bruto anual o el rendimiento neto de tu actividad económica si eres autónomo.',
            animation: 'scale'
          })
        break;

        case 'yearsContributing':
          tippy(tooltip.nativeElement, {
            content: 'Indica cuántos años llevas trabajando.',
            animation: 'scale'
          })
        break;

        case 'regime':
          tippy(tooltip.nativeElement, {
            content: 'Indica si eres asalariado o autónomo.',
            animation: 'scale'
          })
        break;

        case 'annualSalaryIncrease':
          tippy(tooltip.nativeElement, {
            content: 'Cuánto esperas que suba tu salario.',
            animation: 'scale'
          })
        break;

        case 'annualInflation':
          tippy(tooltip.nativeElement, {
            content: 'Cuánto esperas que sea la inflacción anual.',
            animation: 'scale'
          })
        break;

        case 'retirementAge':
          tippy(tooltip.nativeElement, {
            content: 'Indica a qué edad quieres jubilarte',
            animation: 'scale'
          })
        break;

        case 'retirementMonthlyObjective':
          tippy(tooltip.nativeElement, {
            content: 'Indica los ingresos brutos que te gustaría mantener al jubilarte.',
            animation: 'scale'
          })
        break;

        case 'currentSavesMonthly':
          tippy(tooltip.nativeElement, {
            content: 'Cuánto dinero ahorras cada mes para tu jubilación.',
            animation: 'scale'
          })
        break;

        case 'currentReturn':
          tippy(tooltip.nativeElement, {
            content: 'El rendimiento que esperas de tus inversiones hasta jubilarte.',
            animation: 'scale'
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
    if(this.retirementForm.invalid){ 
      this.retirementForm.markAllAsTouched();
      return;
    }

    this.showTable(false);
    this.isCalculating.set(true);
    const normalized_values= this.normalizeValues(this.retirementForm);
    this.retirementSavesService.retirementData.set(normalized_values);
    this.results.set(this.retirementSavesService.retirementResult());
    this.isCalculating.set(false);
  }

  isValidField( fieldName: string ): boolean | null {
    
    if (fieldName === 'retirementMonthlyObjective'){
      const formErrors = this.retirementForm.errors;
      const field = this.retirementForm.get('retirementMonthlyObjective')
    
      if(formErrors && formErrors['retirementMonthlyIsGreater'] && field && field.touched) {
        return true;
      }

    }
    return (this.retirementForm.controls[fieldName].errors && this.retirementForm.controls[fieldName].touched);
  }

  getFieldError( fieldName:string ): string | null{
    
    if(!this.retirementForm.controls[fieldName]) return null; //If there is no field with that name

    const errors = this.retirementForm.controls[fieldName].errors ?? {};

    for(const key in errors){

      switch(key){
        case 'required':
          return 'Este campo es requerido';
        
        case 'min':
          if(['currentAge', 'retirementAge'].includes(fieldName)){
            return `El mínimo son ${errors['min'].min} años`;
          }
          return `El mínimo es ${this.currencyPipe.transform(errors['min'].min, 'EUR', 'symbol', '1.2-2')}`;

        case 'max':
          if(['currentAge', 'retirementAge'].includes(fieldName)){
            return `El máximo son ${errors['max'].max} años`;
          }
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

    const groupErrors = this.retirementForm.errors ?? {};
    
    for(const key in groupErrors){
      
      switch(key){

        case 'retirementMonthlyIsGreater':
          return `El objetivo no puede ser inferior a lo indicado como salario anual ${this.currencyPipe.transform(groupErrors['retirementMonthlyIsGreater'].min, 'EUR', 'symbol', '1.2-2')}/mes - ${this.currencyPipe.transform(groupErrors['retirementMonthlyIsGreater'].total, 'EUR', 'symbol', '1.2-2')}/año`

        default:
          return null;

      }

    }
    
    return null;
  }

  normalizeValues( form:FormGroup ): RetirementData{

    let values: { [key:string]: string|number } = {...form.value};    

    for(const control in values){

      switch(control){

        case 'retirementAge':
        case 'yearsContributing':
        case 'currentAge':
          values[control] = this.normalizeNumber(values[control], false)
        break;

        case 'retirementMonthlyObjective':
        case 'yearlyIncome':
          values[control] = this.normalizeNumber(values[control], true)
        break;

        case 'annualSalaryIncrease':
        case 'annualInflation':
          if(values[control]){
            values[control] = this.normalizeNumber(values[control], true)
          }else{
            values[control] = 0;
          }
        break;

        case 'currentSavesMonthly':
        case 'currentSaves':
          if(values[control]){
            values[control] = this.normalizeNumber(values[control], true)
          }else{
            values[control] = 0;
          }
        break;

        case 'currentReturn':
          if(values[control]){
            values[control] = this.normalizeNumber(values[control], true)
          }else{
            values[control] = 2.5;
          }
          
        break;
      }

    }
    
    return values as RetirementData;
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