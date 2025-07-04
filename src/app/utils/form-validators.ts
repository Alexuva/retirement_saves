import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

/**
 * Validates the min number in a text input that represents a decimal
 * @param control The formcontrol of the input that we want to validate
 * @returns {ValidationErrors|null} Object of type `ValidationErrors` when there is an error, `null` otherwise
 */
export function decimalMinValidation(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value:string = control.value;
    if(value !== null){ //Only validates when the input has some value
      const numericValue:number = parseFloat(value.replaceAll(',','.'));
      if(numericValue < min){
        return { min: { min: min, actual: value } }
      }
    }
    return null;
  };
}

/**
 * Validates the max number in a text input that represents a decimal
 * @param control The formcontrol of the input that we want to validate
 * @returns {ValidationErrors|null} Object of type `ValidationErrors` when there is an error, `null` otherwise
 */
export function decimalMaxValidation(max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value:string = control.value;
    if(value !== null){ //Only validates when the input has some value
      const numericValue:number = parseFloat(value.replaceAll(',','.'));
      if(numericValue > max){
        return { max: { max: max, actual: value } }
      }
    }
    return null;
  };
}

/**
 * Validates if the number is a correct decimal of 1 decimal place
 * @param control The formcontrol of the input that we want to validate
 * @returns {ValidationErrors|null} Object of type `ValidationErrors` when there is an error, `null` otherwise
 */
export function decimalValidation( control: AbstractControl ): ValidationErrors | null {
  const value:string = control.value;
  const DECIMAL_REGEX:RegExp = new RegExp(/^(\d+|\d+,\d{1}|\d+.\d{1})$/);

  if(value !== null){
    if(value.length > 0 && !DECIMAL_REGEX.test(value)) return { decimal: true } 
  }
  
  return null;
}

/**
 * Validates if the number is a correct decimal of 2 decimal places
 * @param control The formcontrol of the input that we want to validate
 * @returns {ValidationErrors|null} Object of type `ValidationErrors` when there is an error, `null` otherwise
 */
export function decimalsValidation( control: AbstractControl ): ValidationErrors | null {
  const value:string = control.value;
  const DECIMALS_REGEX:RegExp = new RegExp(/^(\d+|\d+,\d{1,2}|\d+.\d{1,2})$/);

  if(value !== null){
    if(value.length > 0 && !DECIMALS_REGEX.test(value)) return { decimals: true } 
  }
  
  return null;
}

/**
 * Validates if the number is a correct integer
 * @param control The formcontrol of the input that we want to validate
 * @returns {ValidationErrors|null} Object of type `ValidationErrors` when there is an error, `null` otherwise
 */
export function integerValidation( control: AbstractControl ): ValidationErrors | null {
  const value:string = control.value;
  const INTEGERS_REGEX:RegExp = new RegExp(/^\d+$/);

  if(value !== null){
    if(value.length > 0 && !INTEGERS_REGEX.test(value)) return { integer: true } 
  }
  
  return null;
}

/**
 * Validates if the number is a correct percentage and has a value between 0,1 and 100
 * @param control The formcontrol of the input that we want to validate
 * @returns {ValidationErrors|null} Object of type `ValidationErrors` when there is an error, `null` otherwise
 */
export function percentageValidation( control: AbstractControl): ValidationErrors | null {
  const value = control.value
  const parsedValue = parseFloat(value.replaceAll(',', '.'));
  
  if(value !== null){
    if((parsedValue < 0 || parsedValue > 100)) return { percentage: true };
  }
  
  return null;
}