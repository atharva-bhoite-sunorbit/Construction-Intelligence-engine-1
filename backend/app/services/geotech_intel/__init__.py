"""
Geotechnical Report Intelligence (GTI) module.

Strictly source-grounded extraction of geotechnical investigation reports.
Every value produced by this package originates from exactly one of:

    REPORT | CALCULATED | AI_INTERPRETATION | AI_RECOMMENDATION | USER_ENTERED | REQUIRES_DATA

There are NO global/default geotechnical values anywhere in this package.
Each pipeline run is a pure function of the uploaded document.
"""
