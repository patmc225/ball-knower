/**
 * Enhanced Analytics Tracking for BallKnower
 * Comprehensive event tracking for user behavior and game metrics
 */

import { logAnalyticsEvent } from '../firebaseConfig';

/**
 * Track page views in the application
 * @param {string} pageName - The name of the page being viewed
 * @param {Object} additionalParams - Optional additional parameters to log
 */
export const trackPageView = (pageName, additionalParams = {}) => {
  logAnalyticsEvent('page_view', {
    page_name: pageName,
    page_location: window.location.href,
    page_path: window.location.pathname,
    timestamp: new Date().toISOString(),
    ...additionalParams
  });
};

/**
 * Track user interactions with the application
 * @param {string} actionName - The name of the action (e.g., 'button_click', 'game_start')
 * @param {Object} actionParams - Optional parameters related to the action
 */
export const trackUserAction = (actionName, actionParams = {}) => {
  logAnalyticsEvent(actionName, {
    timestamp: new Date().toISOString(),
    ...actionParams
  });
};

/**
 * Track game-related events with comprehensive metrics
 * @param {string} eventType - The type of game event
 * @param {Object} gameParams - Parameters related to the game event
 */
export const trackGameEvent = (eventType, gameParams = {}) => {
  logAnalyticsEvent(`game_${eventType}`, {
    timestamp: new Date().toISOString(),
    ...gameParams
  });
};

/**
 * Track user authentication events
 * @param {string} authType - The type of auth event
 * @param {Object} authParams - Parameters related to the authentication
 */
export const trackAuthEvent = (authType, authParams = {}) => {
  logAnalyticsEvent(`auth_${authType}`, {
    timestamp: new Date().toISOString(),
    ...authParams
  });
};

/**
 * Track game start with detailed parameters
 * @param {Object} params - Game start parameters
 */
export const trackGameStart = (params = {}) => {
  trackGameEvent('start', {
    game_mode: params.gameMode || 'quickplay',
    player_count: params.playerCount || 1,
    difficulty: params.difficulty || 'normal',
    ...params
  });
};

/**
 * Track game completion with results
 * @param {Object} params - Game completion parameters
 */
export const trackGameComplete = (params = {}) => {
  trackGameEvent('complete', {
    result: params.result, // 'win' or 'loss'
    duration_seconds: params.duration,
    moves_count: params.movesCount,
    score: params.score,
    game_mode: params.gameMode,
    player_rating_change: params.ratingChange,
    ...params
  });
};

/**
 * Track daily challenge completion
 * @param {Object} params - Daily challenge parameters
 */
export const trackDailyChallengeComplete = (params = {}) => {
  logAnalyticsEvent('daily_challenge_complete', {
    challenge_date: params.date,
    moves_count: params.movesCount,
    time_seconds: params.timeSeconds,
    is_optimal: params.isOptimal,
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track user engagement with specific features
 * @param {string} featureName - Name of the feature
 * @param {Object} params - Additional parameters
 */
export const trackFeatureUsage = (featureName, params = {}) => {
  logAnalyticsEvent('feature_usage', {
    feature_name: featureName,
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track search/autocomplete usage
 * @param {Object} params - Search parameters
 */
export const trackSearch = (params = {}) => {
  logAnalyticsEvent('search', {
    search_term: params.term,
    search_type: params.type, // 'player', 'team', 'college'
    results_count: params.resultsCount,
    selected_index: params.selectedIndex,
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track errors for debugging and monitoring
 * @param {Object} params - Error parameters
 */
export const trackError = (params = {}) => {
  logAnalyticsEvent('app_error', {
    error_message: params.message,
    error_type: params.type,
    error_component: params.component,
    error_stack: params.stack ? params.stack.substring(0, 500) : undefined, // Limit stack trace
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track social/sharing events
 * @param {Object} params - Sharing parameters
 */
export const trackShare = (params = {}) => {
  logAnalyticsEvent('share', {
    content_type: params.contentType, // 'score', 'challenge', 'achievement'
    method: params.method, // 'twitter', 'facebook', 'copy_link'
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track user retention milestones
 * @param {string} milestone - Milestone name
 * @param {Object} params - Additional parameters
 */
export const trackMilestone = (milestone, params = {}) => {
  logAnalyticsEvent('milestone', {
    milestone_name: milestone,
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track conversion events (key user actions)
 * @param {string} conversionType - Type of conversion
 * @param {Object} params - Additional parameters
 */
export const trackConversion = (conversionType, params = {}) => {
  logAnalyticsEvent('conversion', {
    conversion_type: conversionType, // 'account_created', 'first_game', 'daily_streak'
    conversion_value: params.value,
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track user engagement time
 * @param {Object} params - Engagement parameters
 */
export const trackEngagement = (params = {}) => {
  logAnalyticsEvent('user_engagement', {
    engagement_time_msec: params.timeMs,
    page_name: params.pageName,
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track tutorial/onboarding progress
 * @param {Object} params - Tutorial parameters
 */
export const trackTutorial = (params = {}) => {
  logAnalyticsEvent('tutorial_progress', {
    step: params.step,
    completed: params.completed,
    timestamp: new Date().toISOString(),
    ...params
  });
};

/**
 * Track leaderboard interactions
 * @param {string} action - Leaderboard action
 * @param {Object} params - Additional parameters
 */
export const trackLeaderboard = (action, params = {}) => {
  logAnalyticsEvent('leaderboard_interaction', {
    action: action, // 'view', 'filter', 'share'
    filter_type: params.filterType,
    timestamp: new Date().toISOString(),
    ...params
  });
};
