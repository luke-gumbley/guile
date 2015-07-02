package com.atlassian.plugins.guile.rest;

import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlRootElement;
import java.sql.Timestamp;

@XmlRootElement(name = "result")
@XmlAccessorType(XmlAccessType.FIELD)
public class GetSprintModel {

	@XmlElement(name = "id")
	private int id;
	public int getId() { return id; }
	public void setId(int id) { this.id = id; }

	@XmlElement(name = "name")
	private String name;
	public String getName() { return name; }
	public void setName(String value) { name = value; }

	@XmlElement(name = "start")
	private Timestamp start;
	public Timestamp getStart() { return start; }
	public void setStart(Timestamp value) { start = value; }

	@XmlElement(name = "end")
	private Timestamp end;
	public Timestamp getEnd() { return end; }
	public void setEnd(Timestamp value) { end = value; }

	@XmlElement(name = "complete")
	private Timestamp complete;
	public Timestamp getComplete() { return complete; }
	public void setComplete(Timestamp value) { complete = value; }

	@XmlElement(name = "periods")
	private PeriodModel[] periods;
	public PeriodModel[] getPeriods() { return periods; }
	public void setPeriods(PeriodModel[] value) { periods = value; }

	public GetSprintModel() {
	}

	public GetSprintModel(int id, String name, Timestamp start, Timestamp end, Timestamp complete, PeriodModel[] periods) {
		this.id = id;
		this.name = name;
		this.start = start;
		this.end = end;
		this.complete = complete;
		this.periods = periods;
	}
}
