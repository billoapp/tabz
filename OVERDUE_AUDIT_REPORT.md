# Overdue Status Audit Report

**Generated:** January 15, 2026  
**System:** Tabeza Staff App  
**Audit Scope:** Overdue tab management system

## Executive Summary

The overdue status system in the staff app is **functionally implemented but not currently active** due to missing business hours configuration across all bars. The system has all necessary database components and UI functionality in place, but cannot automatically detect overdue tabs without proper business hours setup.

## Key Findings

### 1. Current System Status
- ✅ **Overdue UI Page**: Fully functional at `/overdue` route
- ✅ **Database Schema**: Complete with overdue columns (`moved_to_overdue_at`, `overdue_reason`, `device_identifier`)
- ✅ **Business Logic**: Implemented in `businessHours.ts` with proper overdue detection
- ❌ **Business Hours**: Not configured for any of the 11 bars
- ❌ **Automatic Detection**: Not functioning due to missing business hours

### 2. Current Tab Statistics
- **Total tabs**: 5
- **Open tabs**: 4
- **Overdue tabs**: 0
- **Closed tabs**: 1

### 3. Outstanding Balances
- **Open tabs with outstanding balance**: 2
- **Total outstanding amount**: KSh 6,050
- **Average balance**: KSh 3,025 per tab

#### Detailed Outstanding Tabs
1. **Tab #1 (Popos)**
   - Balance: KSh 4,500
   - Age: 14.3 hours
   - Opened: January 14, 2026 at 13:37

2. **Tab #2 (Popos)**
   - Balance: KSh 1,550
   - Age: 7.7 hours
   - Opened: January 14, 2026 at 20:13

### 4. Business Hours Configuration
- **Total bars**: 11
- **Bars with business hours**: 0
- **Bars without business hours**: 11

**All bars missing business hours configuration:**
- Oasis
- Garage bar
- Iconic
- Comrades Rooftop
- Kadida
- Popos
- Tamasha
- Golf Club
- Legend
- Balis best bar
- Vovo Cafe

## System Architecture Analysis

### Frontend Components
1. **Overdue Page** (`/apps/staff/app/overdue/page.tsx`)
   - Displays overdue tabs with search and filtering
   - Shows tab details, outstanding balances, and write-off functionality
   - Real-time balance calculations
   - Modal for detailed tab information

2. **Business Hours Logic** (`/apps/staff/lib/businessHours.ts`)
   - `isWithinBusinessHours()`: Checks if venue is currently open
   - `checkTabOverdueStatus()`: Evaluates individual tab overdue status
   - `checkAndUpdateOverdueTabs()`: Batch processing of overdue tabs

### Database Schema
- **Tabs table**: Extended with overdue-specific columns
- **Indexes**: Optimized for overdue tab queries
- **Constraints**: Proper status validation (open, overdue, closed)

### Overdue Detection Logic
The system determines overdue status based on:
1. **Outstanding balance** (> KSh 0)
2. **Business hours** (venue must be closed)
3. **Tab age** (> 24 hours also triggers overdue)
4. **Tab status** (must be 'open')

## Critical Issues

### 1. Missing Business Hours Configuration
**Impact**: Prevents automatic overdue detection
**Priority**: High
**Resolution**: Configure business hours for all bars

### 2. No Automated Overdue Processing
**Impact**: Manual intervention required for overdue detection
**Priority**: Medium
**Resolution**: Implement scheduled job or trigger

### 3. Outstanding Balances Not Monitored
**Impact**: KSh 6,050 in untracked potential debt
**Priority**: Medium
**Resolution**: Regular monitoring and follow-up procedures

## Recommendations

### Immediate Actions (High Priority)
1. **Configure Business Hours**
   - Set default business hours for all bars (e.g., 09:00-23:00)
   - Update bar management interface to enforce business hours setup
   - Test overdue detection after configuration

2. **Manual Overdue Detection**
   - Run existing overdue detection scripts manually
   - Review tabs older than 24 hours with outstanding balances
   - Consider writing off very old debts as bad debt

### Short-term Improvements (Medium Priority)
3. **Implement Automated Processing**
   - Create scheduled job to run overdue detection every hour
   - Set up database triggers for real-time detection
   - Add notification system for staff when tabs become overdue

4. **Enhanced Monitoring**
   - Create dashboard for outstanding balances
   - Add aging reports (30, 60, 90 days)
   - Implement alerts for high-value overdue tabs

### Long-term Enhancements (Low Priority)
5. **Advanced Features**
   - Customer notification system for overdue tabs
   - Payment plan management
   - Credit scoring system
   - Integration with collection services

## Implementation Roadmap

### Phase 1: System Activation (Week 1)
- [ ] Configure business hours for all 11 bars
- [ ] Test overdue detection functionality
- [ ] Run manual overdue detection on existing tabs
- [ ] Train staff on overdue management procedures

### Phase 2: Automation (Week 2-3)
- [ ] Implement scheduled overdue detection
- [ ] Set up monitoring and alerting
- [ ] Create overdue management dashboard
- [ ] Document procedures and best practices

### Phase 3: Enhancement (Month 2)
- [ ] Add customer notifications
- [ ] Implement aging reports
- [ ] Create write-off approval workflow
- [ ] Add analytics and reporting

## Risk Assessment

### High Risk
- **Revenue Loss**: KSh 6,050 currently untracked
- **Customer Disputes**: No systematic follow-up on outstanding balances

### Medium Risk
- **System Complexity**: Manual processes prone to human error
- **Data Quality**: Inconsistent overdue detection without automation

### Low Risk
- **Technical Issues**: Core functionality is well-implemented
- **Scalability**: System can handle current and projected load

## Conclusion

The overdue status system is **technically complete but operationally inactive**. With proper business hours configuration and automated processing, the system can effectively manage bad debt and improve revenue collection. The immediate priority should be configuring business hours and activating the overdue detection process.

**Next Steps:**
1. Configure business hours for all bars
2. Test overdue detection with current outstanding tabs
3. Implement automated processing
4. Establish monitoring and reporting procedures

---

*This report provides a comprehensive audit of the overdue status system and actionable recommendations for improvement.*
