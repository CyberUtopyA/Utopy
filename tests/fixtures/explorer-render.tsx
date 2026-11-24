import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import LivingExplorer from '../../src/components/LivingExplorer';
import ContractCanvas from '../../src/components/ContractCanvas';
export const renderExplorer=(props:any)=>renderToStaticMarkup(<LivingExplorer {...props}/>);
export const renderCanvas=(props:any)=>renderToStaticMarkup(<ContractCanvas {...props}/>);
