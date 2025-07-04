import { computed, Injectable, signal, WritableSignal } from '@angular/core';

export type LoamData = {
  monthlyIncome: number,
  otherExpenses: number,
  loamInterest: number,
  loamYears: number,
  loamState: HouseState,
  loamUbication: string
}

export type Amortization = {
  i: number;
  initial: number;
  maxPayments: number;
  tax: number;
  payed: number;
  final: number;
}

export enum HouseState {
  NEW = 'new',
  USED = 'used'
}

@Injectable({
  providedIn: 'root'
})
export class AffordableLoam {

  constructor() {}

  loamData: WritableSignal<LoamData> = signal({
    monthlyIncome: 1580,
    otherExpenses: 133,
    loamInterest: 2.5,
    loamYears: 30,
    loamState: HouseState.NEW,
    loamUbication: 'andalucia'
  })

  loamResult = computed(() => {

    const maxPayments = this.maxPayments(this.loamData);
    const maxLoam = this.maxLoam(this.loamData, maxPayments);
    const maxHouseValue = this.maxHouseValue(maxLoam);
    const mustHaveSaves = this.mustHaveSaves(maxHouseValue);
    const additionalCost = this.additionalCost(this.loamData, maxHouseValue);
    const amortization = this.amortization(this.loamData, maxLoam, maxPayments, maxHouseValue);
    const totalInterestPayed = this.totalInterestPayed(amortization);
    const isDebtGreaterThanIncome = computed(()=>{
      const monthlyIncome = this.loamData().monthlyIncome;
      const otherExpenses = this.loamData().otherExpenses;
      const percentage = parseFloat(((otherExpenses / monthlyIncome) * 100).toFixed(2))
      
      return percentage;
    })

    return {
      ...this.loamData(),
      maxPayments,
      maxLoam,
      maxHouseValue,
      mustHaveSaves,
      additionalCost,
      amortization,
      totalInterestPayed,
      isDebtGreaterThanIncome
    }

  })

  communityTax: { [key: string]: number } = {
    'andalucia': 0.07,
    'aragon': 0.08,
    'asturias': 0.08,
    'islas-baleares': 0.08,
    'canarias': 0.065,
    'cantabria': 0.09,
    'castilla-y-leon': 0.08,
    'castilla-la-mancha': 0.09,
    'cataluna': 0.1,
    'extremadura': 0.08,
    'galicia': 0.08,
    'madrid': 0.06,
    'murcia': 0.08,
    'la-rioja': 0.07,
    'valencia': 0.1,
    'pais-vasco': 0.07,
    'navarra': 0.06,
    'ceuta': 0.06,
    'melilla': 0.06,
  }

  /**
   * Calculates the max payment affordable
   * @param loamData The info retreive from the form
   * @returns a `number` representing the max payment affordable
   */
  maxPayments( loamData:WritableSignal<LoamData> ):number{
    const {monthlyIncome, otherExpenses} = loamData();
    const realIncome = parseFloat((( monthlyIncome * 0.35 ) - otherExpenses).toFixed(2))

    return realIncome;
  }

  /**
   * Calculates the max loam affordable
   * @param loamData The info retreive from the form
   * @param maxPayments a `number` representing the max payment affordable
   * @returns a `number` representing the max loam affordable
   */
  maxLoam( loamData:WritableSignal<LoamData>, maxPayments:number ):number {
    const {loamYears, loamInterest} = loamData();

    const monthlyInterest = (loamInterest / 100) / 12;
    const totalPayments = loamYears * 12;

    const downCalculation = (monthlyInterest * Math.pow((1 + monthlyInterest), totalPayments)) / (Math.pow((1 + monthlyInterest), totalPayments) - 1);
    
    const maxLoam = parseFloat((maxPayments / downCalculation).toFixed(2));

    return maxLoam;
  }

  /**
   * Calculates the max house value affordable
   * @param maxLoam a `number` representing the max loam affordable
   * @returns a `number` representing the max house value affordable
   */
  maxHouseValue( maxLoam:number ):number{

    const maxHouseValue = parseFloat((maxLoam / 0.80).toFixed(2));
    
    return maxHouseValue
  }

  /**
   * Calculates the must have saves in order to buy the house
   * @param maxHouseValue a `number` representing the max house value affordable
   * @returns a `number` representing the must have saves in order to buy the house
   */
  mustHaveSaves( maxHouseValue:number ):number {
    const mustHaveSaves = parseFloat((maxHouseValue * 0.3).toFixed(2));

    return mustHaveSaves;
  }

  /**
   * Calculates all the additional cost that happens around a loam  
   * @param loamData The info retreive from the form
   * @param maxHouseValue a `number` representing the max house value affordable
   * @returns `{ total:number, administration:number, taxation:number, notary:number, registry:number, tax:number }` that represents the additional cost
   */
  additionalCost( loamData:WritableSignal<LoamData>, maxHouseValue:number ): { total:number, administration:number, taxation:number, notary:number, registry:number, tax:number } {

    const {loamState, loamUbication} = loamData();
    const administration = 300;
    const taxation = 300;
    const notary = parseFloat((maxHouseValue * 0.0035).toFixed(2))
    const registry = this.registryCost(maxHouseValue);
    const tax = loamState === HouseState.NEW ? parseFloat((maxHouseValue * 0.1).toFixed(2)) : parseFloat((maxHouseValue * this.communityTax[loamUbication]).toFixed(2))

    return {
      total: parseFloat((administration + taxation + notary + registry + tax).toFixed(2)),
      administration,
      taxation,
      notary,
      registry,
      tax
    }
  }

  /**
   * Calculates the cost of the registry
   * @param maxHouseValue  `number` representing the max house value affordable
   * @returns a `number` representing the cost of the registry
   */
  registryCost( maxHouseValue:number ):number {
      let registry = 24.04;
      let multiplier = 1;

      switch (true) {
        case maxHouseValue <= 6010.12:
          registry = 24.04;
          break;

        case maxHouseValue >= 6010.12 && maxHouseValue <= 30050.61:
          let diffLv1 = parseFloat((maxHouseValue - 6010.12).toFixed(2));
          let timesLv1 = parseFloat((diffLv1 / 1000).toFixed(2));
          multiplier = parseFloat((1.75 * timesLv1).toFixed(2));
          registry = parseFloat((24.04 + multiplier).toFixed(2));
          break;

        case maxHouseValue >= 30050.61 && maxHouseValue <= 60101.21:
          let diffLv2 = parseFloat((maxHouseValue - 30050.61).toFixed(2));
          let timesLv2 = parseFloat((diffLv2 / 1000).toFixed(2));
          multiplier = parseFloat((1.25 * timesLv2).toFixed(2));
          registry = parseFloat((24.04 + 42.07 + multiplier).toFixed(2));
          break;

        case maxHouseValue >= 60101.22 && maxHouseValue <= 150253.03:
          let diffLv3 = parseFloat((maxHouseValue - 60101.22).toFixed(2));
          let timesLv3 = parseFloat((diffLv3 / 1000).toFixed(2));
          multiplier = parseFloat((0.75 * timesLv3).toFixed(2));
          registry = parseFloat(
            (24.04 + 42.07 + 37.56 + multiplier).toFixed(2)
          );
          break;

        case maxHouseValue >= 150253.03 && maxHouseValue <= 601012.1:
          let diffLv4 = parseFloat((maxHouseValue - 150253.03).toFixed(2));
          let timesLv4 = parseFloat((diffLv4 / 1000).toFixed(2));
          multiplier = parseFloat((0.3 * timesLv4).toFixed(2));
          registry = parseFloat(
            (24.04 + 42.07 + 37.56 + 67.61 + multiplier).toFixed(2)
          );
          break;

        case maxHouseValue >= 601012.1:
          let diffLv5 = parseFloat((maxHouseValue - 601012.1).toFixed(2));
          let timesLv5 = parseFloat((diffLv5 / 1000).toFixed(2));
          multiplier = parseFloat((0.2 * timesLv5).toFixed(2));
          registry = parseFloat(
            (24.04 + 42.07 + 37.56 + 67.61 + 135.22 + multiplier).toFixed(2)
          );
          break;
      }

      return registry;
  }

  /**
   * Calculates the amortization schedule
   * @param loamData The info retreive from the form
   * @param maxLoam a `number` representing the max loam affordable
   * @param maxPayments a `number` representing the max payment affordable
   * @param maxHouseValue a `number` representing the max house value affordable
   * @returns array of `Amortization` objects
   */
  amortization( loamData:WritableSignal<LoamData>, maxLoam:number, maxPayments:number, maxHouseValue:number ):Amortization[] {
    const { loamInterest,loamYears } = loamData();
    
    const initialPayment = maxHouseValue - maxLoam;
    const totalTime = loamYears * 12;
    
    let leftAmmount = maxLoam; //Initial ammount left - the ammount payed each period
    const result = []

    for(let i = 0; i < totalTime; i++){

      let initial = leftAmmount;
      let tax = parseFloat(((leftAmmount * (loamInterest / 100)) / 12).toFixed(2))
      let payed = parseFloat((maxPayments - tax).toFixed(2))
      let final = parseFloat((leftAmmount - payed).toFixed(2))

      if(i === totalTime - 1){
        payed += final - 0;
        final = 0;
      }

      leftAmmount = parseFloat((leftAmmount - payed).toFixed(2))

      result.push({
        i: i + 1,
        initial,
        maxPayments,
        tax,
        payed,
        final
      })

      if(leftAmmount <= 0){
        break;
      }

    }

    return result;
  }

  /**
   * Calculates the total interest payed
   * @param amortization `Amortization` array
   * @returns a `number` representing the total interest payed in the loam
   */
  totalInterestPayed( amortization:Amortization[] ):number {
    let totalTax = 0;

    amortization.forEach( element => totalTax += element.tax );

    return totalTax;
  }

}
