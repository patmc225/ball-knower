import { logAnalyticsEvent } from './firebaseConfig';

const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(metric => {
        onPerfEntry(metric);
        logAnalyticsEvent('web_vitals', {
          metric_name: 'CLS',
          metric_value: metric.value,
          metric_id: metric.id
        });
      });
      getFID(metric => {
        onPerfEntry(metric);
        logAnalyticsEvent('web_vitals', {
          metric_name: 'FID',
          metric_value: metric.value,
          metric_id: metric.id
        });
      });
      getFCP(metric => {
        onPerfEntry(metric);
        logAnalyticsEvent('web_vitals', {
          metric_name: 'FCP',
          metric_value: metric.value,
          metric_id: metric.id
        });
      });
      getLCP(metric => {
        onPerfEntry(metric);
        logAnalyticsEvent('web_vitals', {
          metric_name: 'LCP',
          metric_value: metric.value,
          metric_id: metric.id
        });
      });
      getTTFB(metric => {
        onPerfEntry(metric);
        logAnalyticsEvent('web_vitals', {
          metric_name: 'TTFB',
          metric_value: metric.value,
          metric_id: metric.id
        });
      });
    });
  }
};

export default reportWebVitals;
