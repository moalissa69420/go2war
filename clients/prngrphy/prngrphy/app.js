// Application Data
const appData = {
  brand: {
    name: "PRNGRPHY",
    product: "XL Studded Suude Boots",
    launchDate: "September 2, 2025",
    positioning: "Luxury Punk Streetwear",
    totalUnits: 500,
    priceUSD: 225,
    shippingCost: 25,
    netPrice: 200,
    unitCost: 29.5,
    profitPerUnit: 170.5,
    profitMargin: 85.2
  },
  inventory: {
    black: 185,
    brown: 150,
    pink: 165
  },
  month1: {
    targetUnits: 43,
    grossRevenue: 9675,
    netRevenue: 8600,
    grossProfit: 7331.5,
    marketingBudget: 2500,
    netProfit: 4831.5,
    roi: 56.8
  },
  annualProjections: {
    totalGrossRevenue: 112500,
    totalNetRevenue: 100000,
    totalCogs: 14750,
    grossProfit: 85250,
    marketingInvestment: 24000,
    finalNetProfit: 61250,
    finalROI: 720.6
  },
  marketingChannels: [
    {channel: "Meta Ads", percentage: 40, budget: 9600, strategy: "Retargeting + niche targeting"},
    {channel: "Influencer Partnerships", percentage: 25, budget: 6000, strategy: "Micro-influencers in punk/alt fashion"},
    {channel: "Content Creation", percentage: 15, budget: 3600, strategy: "Professional shoots, UGC campaigns"},
    {channel: "PR/Events", percentage: 10, budget: 2400, strategy: "Montreal scene integration"},
    {channel: "Email Marketing", percentage: 5, budget: 1200, strategy: "Club member nurturing"},
    {channel: "TikTok Organic", percentage: 5, budget: 1200, strategy: "Trend participation"}
  ],
  monthlyTimeline: [
    {month: 1, units: 43, revenue: 9675, cumulative: 43, cumulativeRevenue: 9675},
    {month: 2, units: 42, revenue: 9450, cumulative: 85, cumulativeRevenue: 19125},
    {month: 3, units: 41, revenue: 9225, cumulative: 126, cumulativeRevenue: 28350},
    {month: 4, units: 42, revenue: 9450, cumulative: 168, cumulativeRevenue: 37800},
    {month: 5, units: 41, revenue: 9225, cumulative: 209, cumulativeRevenue: 47025},
    {month: 6, units: 42, revenue: 9450, cumulative: 251, cumulativeRevenue: 56475},
    {month: 7, units: 41, revenue: 9225, cumulative: 292, cumulativeRevenue: 65700},
    {month: 8, units: 42, revenue: 9450, cumulative: 334, cumulativeRevenue: 75150},
    {month: 9, units: 41, revenue: 9225, cumulative: 375, cumulativeRevenue: 84375},
    {month: 10, units: 42, revenue: 9450, cumulative: 417, cumulativeRevenue: 93825},
    {month: 11, units: 41, revenue: 9225, cumulative: 458, cumulativeRevenue: 103050},
    {month: 12, units: 42, revenue: 9450, cumulative: 500, cumulativeRevenue: 112500}
  ]
};

// Chart colors
const chartColors = ['#1FB8CD', '#FFC185', '#B4413C', '#ECEBD5', '#5D878F', '#DB4545', '#D2BA4C', '#964325', '#944454', '#13343B'];

// Slide Management
class SlideManager {
  constructor() {
    this.currentSlide = 1;
    this.totalSlides = document.querySelectorAll('.slide').length;
    this.init();
  }

  init() {
    this.updateSlideCounter();
    this.updateNavigationButtons();
    this.bindEvents();
    
    // Initialize charts after a short delay to ensure DOM is ready
    setTimeout(() => {
      this.initializeCharts();
    }, 200);
  }

  bindEvents() {
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.nextSlide();
      });
    }
    
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.prevSlide();
      });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.nextSlide();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevSlide();
      }
    });
  }

  nextSlide() {
    if (this.currentSlide < this.totalSlides) {
      this.goToSlide(this.currentSlide + 1);
    }
  }

  prevSlide() {
    if (this.currentSlide > 1) {
      this.goToSlide(this.currentSlide - 1);
    }
  }

  goToSlide(slideNumber) {
    // Hide current slide
    const currentSlideElement = document.getElementById(`slide-${this.currentSlide}`);
    if (currentSlideElement) {
      currentSlideElement.classList.remove('active');
    }
    
    // Show new slide
    this.currentSlide = slideNumber;
    const newSlideElement = document.getElementById(`slide-${this.currentSlide}`);
    if (newSlideElement) {
      newSlideElement.classList.add('active');
    }
    
    // Update UI
    this.updateSlideCounter();
    this.updateNavigationButtons();
  }

  updateSlideCounter() {
    const currentSlideElement = document.getElementById('currentSlide');
    const totalSlidesElement = document.getElementById('totalSlides');
    
    if (currentSlideElement) {
      currentSlideElement.textContent = this.currentSlide;
    }
    if (totalSlidesElement) {
      totalSlidesElement.textContent = this.totalSlides;
    }
  }

  updateNavigationButtons() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (prevBtn) {
      prevBtn.disabled = this.currentSlide === 1;
    }
    if (nextBtn) {
      nextBtn.disabled = this.currentSlide === this.totalSlides;
    }
  }

  initializeCharts() {
    try {
      this.createMarketChart();
      this.createRevenueChart();
      this.createMarketingChart();
      this.createROIChart();
    } catch (error) {
      console.error('Error initializing charts:', error);
    }
  }

  createMarketChart() {
    const ctx = document.getElementById('marketChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['2020', '2021', '2022', '2023', '2024', '2025'],
        datasets: [
          {
            label: 'Y2K Fashion Interest',
            data: [20, 35, 60, 85, 95, 100],
            borderColor: chartColors[0],
            backgroundColor: chartColors[0] + '20',
            fill: true,
            tension: 0.4
          },
          {
            label: 'UGG Boot Searches',
            data: [100, 80, 65, 70, 85, 95],
            borderColor: chartColors[1],
            backgroundColor: chartColors[1] + '20',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Punk Aesthetic Adoption',
            data: [15, 25, 40, 65, 80, 90],
            borderColor: chartColors[2],
            backgroundColor: chartColors[2] + '20',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#f5f5f5'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#a7a9a9'
            },
            grid: {
              color: 'rgba(167, 169, 169, 0.1)'
            }
          },
          y: {
            ticks: {
              color: '#a7a9a9'
            },
            grid: {
              color: 'rgba(167, 169, 169, 0.1)'
            }
          }
        }
      }
    });
  }

  createRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: appData.monthlyTimeline.map(m => `Month ${m.month}`),
        datasets: [
          {
            label: 'Monthly Revenue',
            data: appData.monthlyTimeline.map(m => m.revenue),
            backgroundColor: chartColors[0],
            borderColor: chartColors[0],
            borderWidth: 1
          },
          {
            label: 'Cumulative Revenue',
            data: appData.monthlyTimeline.map(m => m.cumulativeRevenue),
            type: 'line',
            borderColor: chartColors[1],
            backgroundColor: chartColors[1] + '40',
            fill: false,
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            labels: {
              color: '#f5f5f5'
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#a7a9a9'
            },
            grid: {
              color: 'rgba(167, 169, 169, 0.1)'
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: {
              color: '#a7a9a9',
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            },
            grid: {
              color: 'rgba(167, 169, 169, 0.1)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            ticks: {
              color: '#a7a9a9',
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        }
      }
    });
  }

  createMarketingChart() {
    const ctx = document.getElementById('marketingChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: appData.marketingChannels.map(c => c.channel),
        datasets: [{
          data: appData.marketingChannels.map(c => c.percentage),
          backgroundColor: chartColors.slice(0, appData.marketingChannels.length),
          borderColor: '#262828',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#f5f5f5',
              padding: 20,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const channel = appData.marketingChannels[context.dataIndex];
                return `${context.label}: ${context.parsed}% ($${channel.budget.toLocaleString()})`;
              }
            }
          }
        }
      }
    });
  }

  createROIChart() {
    const ctx = document.getElementById('roiChart');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Investment', 'Revenue', 'Profit'],
        datasets: [{
          label: 'Amount ($)',
          data: [42250, 112500, 61250],
          backgroundColor: [chartColors[2], chartColors[0], chartColors[1]],
          borderColor: [chartColors[2], chartColors[0], chartColors[1]],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#a7a9a9'
            },
            grid: {
              color: 'rgba(167, 169, 169, 0.1)'
            }
          },
          y: {
            ticks: {
              color: '#a7a9a9',
              callback: function(value) {
                return '$' + (value / 1000) + 'K';
              }
            },
            grid: {
              color: 'rgba(167, 169, 169, 0.1)'
            }
          }
        }
      }
    });
  }
}

// Interactive Elements
class InteractiveElements {
  constructor() {
    this.init();
  }

  init() {
    setTimeout(() => {
      this.animateProgressBars();
      this.setupHoverEffects();
    }, 500);
  }

  animateProgressBars() {
    // Animate inventory bars
    setTimeout(() => {
      const bars = document.querySelectorAll('.bar-fill');
      bars.forEach(bar => {
        const originalWidth = bar.style.width;
        bar.style.width = '0%';
        setTimeout(() => {
          bar.style.width = originalWidth;
        }, 300);
      });
    }, 1000);

    // Animate margin bar
    setTimeout(() => {
      const marginBar = document.querySelector('.margin-profit');
      if (marginBar) {
        const originalWidth = marginBar.style.width;
        marginBar.style.width = '0%';
        setTimeout(() => {
          marginBar.style.width = '85.2%';
        }, 500);
      }
    }, 1200);
  }

  setupHoverEffects() {
    // Add hover effects to cards
    const cards = document.querySelectorAll('.exec-card, .trend-item, .position-card, .fin-card, .advantage-card, .risk-card, .phase-card, .step-card');
    
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-5px)';
        card.style.transition = 'transform 0.3s ease';
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
      });
    });

    // Add hover effects to metrics
    const metrics = document.querySelectorAll('.stat, .metric, .proj-stat, .return-metric');
    
    metrics.forEach(metric => {
      metric.addEventListener('mouseenter', () => {
        const number = metric.querySelector('.stat-number, .metric-value, .proj-number, .return-value');
        if (number) {
          number.style.transform = 'scale(1.1)';
          number.style.transition = 'transform 0.3s ease';
        }
      });
      
      metric.addEventListener('mouseleave', () => {
        const number = metric.querySelector('.stat-number, .metric-value, .proj-number, .return-value');
        if (number) {
          number.style.transform = 'scale(1)';
        }
      });
    });
  }
}

// Utility Functions
class Utilities {
  static formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  static formatNumber(number) {
    return new Intl.NumberFormat('en-US').format(number);
  }

  static calculateROI(profit, investment) {
    return ((profit / investment) * 100).toFixed(1);
  }
}

// Performance Tracker
class PerformanceTracker {
  constructor() {
    this.metrics = {
      slideViews: {},
      timeSpent: {},
      interactions: 0
    };
    this.init();
  }

  init() {
    this.trackSlideViews();
    this.trackInteractions();
  }

  trackSlideViews() {
    // Track when slides are viewed
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const slideId = entry.target.id;
          this.metrics.slideViews[slideId] = (this.metrics.slideViews[slideId] || 0) + 1;
        }
      });
    });

    document.querySelectorAll('.slide').forEach(slide => {
      observer.observe(slide);
    });
  }

  trackInteractions() {
    // Track button clicks and other interactions
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('nav-btn') || e.target.closest('.nav-btn')) {
        this.metrics.interactions++;
      }
    });
  }

  getMetrics() {
    return this.metrics;
  }
}

// Theme Manager
class ThemeManager {
  constructor() {
    this.currentTheme = this.detectPreferredTheme();
    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.setupThemeToggle();
  }

  detectPreferredTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'dark'; // Default to dark for this presentation
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-color-scheme', theme);
    this.currentTheme = theme;
  }

  setupThemeToggle() {
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      this.applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }
}

// Data Validator
class DataValidator {
  static validateBusinessMetrics() {
    const errors = [];
    
    // Validate unit economics
    const calculatedProfit = appData.brand.netPrice - appData.brand.unitCost;
    if (Math.abs(calculatedProfit - appData.brand.profitPerUnit) > 0.01) {
      errors.push('Profit per unit calculation mismatch');
    }

    // Validate profit margin
    const calculatedMargin = (appData.brand.profitPerUnit / appData.brand.netPrice) * 100;
    if (Math.abs(calculatedMargin - appData.brand.profitMargin) > 0.1) {
      errors.push('Profit margin calculation mismatch');
    }

    // Validate monthly timeline totals
    const totalUnits = appData.monthlyTimeline.reduce((sum, month) => sum + month.units, 0);
    if (totalUnits !== appData.brand.totalUnits) {
      errors.push('Monthly units don\'t sum to total units');
    }

    return errors;
  }
}

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Validate data integrity
  const validationErrors = DataValidator.validateBusinessMetrics();
  if (validationErrors.length > 0) {
    console.warn('Data validation warnings:', validationErrors);
  }

  // Initialize all components with proper error handling
  try {
    const slideManager = new SlideManager();
    const interactiveElements = new InteractiveElements();
    const themeManager = new ThemeManager();
    const performanceTracker = new PerformanceTracker();

    // Expose utilities globally for debugging
    window.AppUtils = {
      slideManager,
      performanceTracker,
      themeManager,
      data: appData,
      formatCurrency: Utilities.formatCurrency,
      formatNumber: Utilities.formatNumber
    };

    console.log('PRNGRPHY Launch Strategy Presentation Loaded Successfully');
    console.log('Navigation: Use arrow keys or navigation buttons');
    console.log('Total slides:', slideManager.totalSlides);
    
  } catch (error) {
    console.error('Error initializing application:', error);
  }

  // Global error handling
  window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
  });

  // Add smooth scrolling for better UX
  document.documentElement.style.scrollBehavior = 'smooth';

  // Optimize for performance
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Preload next slide content
      console.log('Performance optimization: Preloading complete');
    });
  }
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SlideManager,
    InteractiveElements,
    ThemeManager,
    Utilities,
    appData
  };
}