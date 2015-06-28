package com.atlassian.plugins.guile.rest;

import org.codehaus.jackson.annotate.JsonIgnoreProperties;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import java.sql.Timestamp;

@JsonIgnoreProperties(ignoreUnknown = true)
@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class RateModel {

	@XmlElement(name = "start")
	private Timestamp start;
	public Timestamp getStart() { return start; }
	public void setStart(Timestamp value) { start = value; }

	@XmlElement(name = "end")
	private Timestamp end;
	public Timestamp getEnd() { return end; }
	public void setEnd(Timestamp value) { end = value; }

	@XmlElement(name = "rate")
	private float rate;
	public float getRate() { return rate; }
	public void setRate(float value) { rate = value; }

	public RateModel() {
	}

	public RateModel(Timestamp start, Timestamp end, float rate) {
		this.start = start;
		this.end = end;
		this.rate = rate;
	}
}
