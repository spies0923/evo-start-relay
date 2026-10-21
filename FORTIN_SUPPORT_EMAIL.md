# Draft email to Fortin technical support

**Status: DRAFT. Not sent.** Fill in the bracketed fields before sending. Do not include account
credentials, device serials or VINs beyond what Fortin needs.

---

**To:** Fortin technical support (via fortin.ca support contact)
**Subject:** EVO-ONE (RS fw 1.31): documented interface for third-party remote-start trigger and status

Hello,

I have an EVO-ONE installed and working on a 2017 Audi A6 C7.5 2.0 TDI (push-to-start, automatic,
right-hand drive). Details:
- bypass firmware 60.12, remote-starter firmware 1.31;
- DCryptor completed;
- installed wire-to-wire per guide #79791;
- 3× Lock remote start working;
- no RF kit.

The vehicle is in South Africa, where the EVO-START LTE's cellular bands are not available. I would
like to add my own cellular controller. It would use only a Fortin-documented, supported interface,
and keep all of the EVO-ONE's safety and takeover logic. I don't want to connect anything to the
vehicle's CAN bus or immobiliser, or emulate Fortin accessories. Could you please help with the
following?

**RS-232 data-link port**
1. Does the EVO-ONE support third-party remote start/stop through the "RS-232 data-link & FlashLink updater" port?
2. If yes, is the interface officially documented? Can you provide the connector type and pinout, the electrical levels (true RS-232 or TTL, and voltage), the serial settings, and the command and status message specification?
3. Is it supported by remote-starter firmware 1.31? Does it need any setting or a specific firmware?

**Discrete trigger (Function #38)**
4. Your EVO-ONE guides list Function #38 mode "Start/Stop on trigger shock sensor". Is this supported and recommended on firmware 1.31 for an external controller?
5. If so, please give:
   - the exact connector and pin;
   - the trigger polarity;
   - the input's open-circuit voltage and the current it sinks;
   - the required pulse duration, and whether start and stop each take a pulse (toggle) or a held signal;
   - whether any alarm option, such as 14.2, must be enabled.
6. Does selecting that mode disable "Press 3× Lock to remote start"? Can both work at once?
7. When started this way, does the EVO-ONE apply exactly the same safety and shutdown conditions as other start methods: hood, brake, gear, run time and takeover?

**Status and confirmation**
8. Does the EVO-ONE have a documented output or message that confirms the engine is running under remote start, for example a remote-start-active or ground-when-running output? Which pin is it, what type, and what level?
9. Are any fault or refusal codes available to an external device?

**Accessories, restrictions and region**
10. Is any additional Fortin accessory or cable required?
11. Are there warranty, safety or compatibility restrictions on connecting a third-party controller to these inputs?
12. Is there any Fortin telematics product and plan that you support in South Africa?

Thank you,
[Name]
[Installer / shop, if applicable]
[Contact]
